const config = require('./config')
const puppeteer = require('puppeteer')
const path = require('path')
const logger = require('./logger')

const verifyRecaptcha = async (req) => {
  // TODO register
  return true
  const token = req.body.recaptchaToken
  const secret = config.recaptchaSecret
  try {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
      { method: 'POST' }
    )
    const scoreData = await response.json()

    return (scoreData.success && scoreData.score >= 0.5 && scoreData.action === 'submit')
  } catch {
    return false
  }

}

const initPuppeteer = async () => {
  const browser = await puppeteer.launch({
    executablePath: config.puppeteerExecutablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })
  const page = await browser.newPage()
  await page.setViewport({
    width: 1280,
    height: 1280,
    deviceScaleFactor: 0.5,
  })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (['image', 'font'].includes(req.resourceType())) req.abort()
    else req.continue()
  })
  return { browser, page }
}

const waitFor = async (ms = 503 * Math.random() + 1001) => await new Promise((resolve) => setTimeout(resolve, ms))

const performActions = async (page, actions) => {
  for (const action of actions) {
    const [selector, actionType] = Object.entries(action)[0]
    switch (actionType) {
      case 'scrollTo':
        await page.evaluate((sel) => {
          document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' })
        }, selector)
        break
      case 'click':
        await page.click(selector)
        break
      case 'iframe':
      // TODO Handle iframe forms
      // const iframeHandle = await page.$(selector)
      // const frame = await iframeHandle.contentFrame()
      default:
        throw new Error(`Unsupported action: ${actionType}`)
    }
    await waitFor()
  }
}

const processFields = async (webpage, details, page, jobId) => {
  for (const field of webpage.fields) {
    const key = field.id
    const value = details[key]

    if (value !== undefined) {
      const { querySelector, querySelectorAllIndex, inputType } = field

      const selectElement = async () => {
        if (querySelectorAllIndex !== undefined) {
          return await page.evaluateHandle((selector, index) => {
            const elements = document.querySelectorAll(selector)
            if (index >= elements.length) throw new Error(`Index ${index} out of bounds for selector "${selector}" ${elements?.length}`)
            return elements[index]
          }, querySelector, querySelectorAllIndex)
        } else {
          return await page.$(querySelector)
        }
      }

      const clickElement = async () => {
        if (querySelectorAllIndex !== undefined) {
          await page.evaluate((selector, index) => {
            document.querySelectorAll(selector)[index].click()
          }, querySelector, querySelectorAllIndex)
        } else {
          await page.click(querySelector)
        }
      }

      const typeIntoElement = async (text, options = {}) => {
        if (querySelectorAllIndex !== undefined) {
          const element = await selectElement()
          await element.type(text, options)
        } else {
          await page.type(querySelector, text, options)
        }
      }

      const isElementChecked = async () => {
        if (querySelectorAllIndex !== undefined) {
          return await page.evaluate((selector, index) => {
            return document.querySelectorAll(selector)[index].checked
          }, querySelector, querySelectorAllIndex)
        } else {
          return await page.$eval(querySelector, el => el.checked)
        }
      }

      const selectOption = async (value) => {
        if (querySelectorAllIndex !== undefined) {
          await page.evaluate((selector, index, val) => {
            const select = document.querySelectorAll(selector)[index]
            select.value = val
            const event = new Event('change', { bubbles: true })
            select.dispatchEvent(event)
          }, querySelector, querySelectorAllIndex, value)
        } else {
          await page.select(querySelector, value)
        }
      }

      switch (inputType) {
        case 'text':
        case 'textarea':
        case 'url':
          await typeIntoElement(value, { delay: 111 + (30 * Math.random()).toFixed(0) })
          break

        case 'checkbox':
          const isChecked = await isElementChecked()
          if ((value === true || value === 'true') && !isChecked) {
            await clickElement()
          } else if (!(value === true || value === 'true') && isChecked) {
            await clickElement()
          }
          break

        default: // Radio or Select (dropdown) input
          if (querySelector.includes('select')) {
            const option = inputType.find((opt) => opt === value)
            if (!option) throw new Error(`Invalid option for ${key}: ${value}`)
            await selectOption(value)
          } else {
            const radioValue = value === 'Yes' ? "true" : value === 'No' ? "false" : value
            if (querySelectorAllIndex !== undefined) {
              await page.evaluate((selector, index) => {
                const radioButtons = document.querySelectorAll(selector)
                if (index < radioButtons.length) {
                  let radioButton = radioButtons[index]
                  let i = 0
                  while (radioButton.value !== radioValue && index < radioButtons.length) { radioButton = radioButtons[index + ++i] }
                  radioButton.click()
                } else {
                  throw new Error(`Index ${index} out of bounds for radio selector "${selector}"`)
                }
              }, querySelector, querySelectorAllIndex)
            } else {
              const radioSelector = `${querySelector}[value="${radioValue}"]`
              await page.click(radioSelector)
            }
          }
          break
      }

      // Perform subActions
      if (field.subActions && Array.isArray(field.subActions) && field.subActions.length) {
        await performActions(page, field.subActions)
      }
    }
  }
}

const processWebpage = async (sendMsg, index, webpages, webpage, page, details, jobId) => {
  try {
    await page.goto(webpage.url, { waitUntil: 'networkidle0' })
    await waitFor()

    // Perform actions
    if (webpage.actions && Array.isArray(webpage.actions)) {
      await performActions(page, webpage.actions)
    }

    // Fill form fields
    await processFields(webpage, details, page, jobId, performActions)

    // Submit form
    let submissionSuccess = false
    if (page.$(webpage.submit)) {
      submissionSuccess = true
      await page.click(webpage.submit)
    }

    if (submissionSuccess) {
      sendMsg('success', ((index + 1) / webpages?.length) * 100, false, webpage.title)
    } else {
      throw new Error('Submission failed')
    }
  } catch (error) {
    logger.info(`Webpage signing failure: ${error.message}`)
    sendMsg('failure', ((index + 1) / webpages?.length) * 100, false, webpage.title)
    sendMsg(`failure: ${error.message}`, ((index + 1) / webpages?.length) * 100, true, webpage.title)
  }
}

const startSigning = async (req, jobId, jobs) => {
  const job = jobs[jobId]
  const { selected, details, entity } = req.body

  const sendMsg = (message = '', progress = 0, error = false, title = '') => {
    const msgObj = { message, progress: 0, error, title }
    job.messages.push(msgObj)
    job.queue.forEach(client => {
      client.write(`data: ${JSON.stringify(msgObj)}\n\n`)
    })
  }

  const sendFailed = () => {
    sendMsg(`Error: internal server error`, 0, true)
    job.status = 'error'
  }

  const verified = verifyRecaptcha(req)
  const invalid = !Array.isArray(selected) || !selected?.length || typeof details !== 'object'
  const honeyPotted = details['retype-name']
  if (!verified || invalid || honeyPotted) {
    logger.error(`Failed - !verified: ${!verified}, invalid: ${invalid}, honeyPotted: ${honeyPotted}`)
    sendFailed()
    return
  }

  let webpages
  try {
    const response = await fetch(`${config.dataUrl}${entity}.json`)
    const jsonData = await response.json()
    webpages = jsonData.webpages.filter((x) => selected.includes(x.title))
  } catch (error) {
    logger.error('Error fetching or processing JSON data file.')
  }

  if (webpages && !webpages.length) {
    sendFailed()
    return
  }

  let browserInstance
  try {
    job.status = 'processing'
    const { browser, page } = await initPuppeteer()
    browserInstance = browser

    for (const [index, webpage] of webpages.entries()) {
      sendMsg('processing', (index / webpages?.length) * 100, false, webpage.title)

      if (webpage.auto === "none") {
        //user manual complete
        sendMsg('failure', ((index + 1) / webpages?.length) * 100, false, webpage.title)
        continue
      }
      const webpageTimeout = await Promise.race([
        processWebpage(sendMsg, index, webpages, webpage, page, details, jobId),
        new Promise((resolve) => setTimeout(() => {
          resolve('timed-out')
        }, 2 * 60 * 1000))
      ])
      if (webpageTimeout === 'timed-out') {
        sendMsg('failure', ((index + 1) / webpages?.length) * 100, false, webpage.title)
        continue
      }
    }

    sendMsg('complete', 100, false, 'Signing is complete')
    job.status = 'completed'
  } catch (error) {
    logger.error(`Run error: ${error.message}`)
    sendMsg(`Error: ${error.message}`, 0, true)
    job.status = 'error'
  } finally {
    await browserInstance.close()
  }
}

const setSEEHeader = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': config.corsOrigin,
    'Access-Control-Allow-Credentials': 'true'
  })
  res.write('\n')
}

const getSSE = (req, res, jobId, jobs) => {
  try {
    setSEEHeader(res)

    const job = jobs[jobId]
    if (!job) {
      logger.error('Job not found')
      res.write(`data: ${JSON.stringify({ message: 'Job not found', error: true })}\n\n`)
      res.end()
      return
    }

    job.messages.forEach((msg) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`)
    })

    job.queue.push(res)

    req.on('close', () => {
      job.queue = job.queue.filter((client) => client !== res)
      if (job.status === 'completed' || job.status === 'error') {
        logger.info('Run: ' + job.status)
        setTimeout(() => delete jobs[jobId], config.jobTimeoutMins * 60 * 1000)
      }
    })
  } catch (error) {
    logger.error('SSE error: ' + error.message)
  }
}

module.exports = { startSigning, getSSE }
