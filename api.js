const config = require('./config')
const puppeteer = require('puppeteer')
const path = require('path')

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

const takeScreenshot = async (jobId, webpage, page) => {
  const dir = path.join(__dirname, 'error')
  const fName = `${jobId}-${webpage.title.replace(/\s+/g, '_')}.png`
  await page.screenshot({ path: path.join(dir, fName) })
}

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
          await typeIntoElement(value, { delay: 100 + 100 * Math.random() })
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
    if (page.$(webpage.submit)) submissionSuccess = true
    //await page.click(webpage.submit)

    if (submissionSuccess) {
      sendMsg('success', ((index + 1) / webpages?.length) * 100, false, webpage.title)

    } else {
      await takeScreenshot("failed-", webpage, page)
      throw new Error('Submission failed')
    }
  } catch (error) {
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

  if (!Array.isArray(selected) || !selected?.length || typeof details !== 'object') {
    sendMsg('Invalid input: selected array and details object required', 0, true)
    job.status = 'error'
    return
  }

  let webpages
  try {
    const response = await fetch(`${config.dataUrl}${entity}.json`)
    const jsonData = await response.json()
    webpages = jsonData.webpages.filter((x) => selected.includes(x.title))
  } catch (error) {
    console.error('Error fetching or processing JSON data file:', error)
  }

  if (webpages && !webpages.length) {
    sendMsg('No matching webpages found', 0, true)
    job.status = 'error'
    return
  }

  job.status = 'processing'
  const { browser, page } = await initPuppeteer()

  try {
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
    sendMsg(`Error: ${error.message}`, 0, true)
    job.status = 'error'
  } finally {
    await browser.close()
  }
}

const getSSE = (req, res, jobId, jobs) => {
  const job = jobs[jobId]
  if (!job) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.write(`data: ${JSON.stringify({ message: 'Job not found', error: true })}\n\n`)
    res.end()
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  job.messages.forEach((msg) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`)
  })

  job.queue.push(res)

  req.on('close', () => {
    job.queue = job.queue.filter((client) => client !== res)
    if (job.status === 'completed' || job.status === 'error') {
      setTimeout(() => delete jobs[jobId], config.jobTimeoutMins * 60 * 1000)
    }
  })
}

module.exports = { startSigning, getSSE }
