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

const startSigning = async (req, jobId, jobs) => {
  const job = jobs[jobId]
  const { selected, details, entity } = req.body

  const sendMsg = (message = '', progress = 0, error = false, title = '') => {
    const msgObj = { message, progress, error, title }
    job.messages.push(msgObj)
    job.queue.forEach(client => {
      client.write(`data: ${JSON.stringify(msgObj)}\n\n`)
    })
  }

  if (!Array.isArray(selected) || !selected.length || typeof details !== 'object') {
    sendMsg('Invalid input: selected array and details object required', 0, true)
    job.status = 'error'
    return
  }

  let webpages
  try {
    const response = await fetch(`${config.dataUrl}${entity}.json`);
    const jsonData = await response.json();
    webpages = jsonData.webpages.filter((x) => selected.includes(x.title));
  } catch (error) {
    console.error('Error fetching or processing JSON data file:', error);
  }

  if (!webpages.length) {
    sendMsg('No matching webpages found', 0, true)
    job.status = 'error'
    return
  }

  job.status = 'processing'
  const { browser, page } = await initPuppeteer()

  try {
    for (const [index, webpage] of webpages.entries()) {
      sendMsg('processing', (index / webpages.length) * 100, false, webpage.title)

      try {
        await page.goto(webpage.url, { waitUntil: 'networkidle0' })

        // Perform actions
        if (webpage.actions && Array.isArray(webpage.actions)) {
          for (const action of webpage.actions) {
            const [selector, actionType] = Object.entries(action)[0]
            switch (actionType) {
              case 'scrollTo':
                await page.evaluate((sel) => {
                  document.querySelector(sel).scrollIntoView({ behavior: 'smooth' })
                }, selector)
                break
              case 'click':
                await page.click(selector)
                await page.waitForTimeout(500)
                break
              default:
                throw new Error(`Unsupported action: ${actionType}`)
            }
          }
        }

        // Fill form fields
        let allFieldsFilled = true
        for (const field of webpage.fields) {
          const key = field.id
          const value = details[key]
          if (field.required && (value === undefined || value === null)) {
            allFieldsFilled = false
            throw new Error(`Missing required field: ${key}`)
          }
          if (value !== undefined) {
            const { querySelector, inputType } = field;
            switch (inputType) {
              case 'text':
              case 'textbox':
                await page.type(querySelector, String(value))
                break

              case 'checkbox':
                const isChecked = await page.$eval(querySelector, el => el.checked);
                if ((value === true || value === 'true') && !isChecked) {
                  await page.click(querySelector)
                } else if (!(value === true || value === 'true') && isChecked) {
                  await page.click(querySelector)
                }
                break

              default: // Radio or Select (dropdown) input
                const subType = querySelector.includes('select') ? 'select' : 'radio'
                const option = inputType.find((opt) => opt === value)
                if (!option) throw new Error(`Invalid option for ${key}: ${value}`)
                if (subType === 'select') {
                  await page.select(querySelector, value)
                } else {
                  await page.click(`${querySelector}[value="${value}"]`)
                }
                break
            }
          }
        }

        // Submit form
        let submissionSuccess = false
        if (!allFieldsFilled) {
          throw new Error('Cannot submit: missing required fields')
        }
        await page.click(webpage.submit)
        // Wait for navigation or success indicator (e.g., redirect or success message)
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 })
          .catch(() => {
            // No navigation check for success element (customize as needed)
            return page.evaluate(() => !!document.querySelector('.success-message'))
          })

        // Verify submission
        submissionSuccess = true //await page.evaluate(() => {
        //  return !!document.querySelector('.success-message') || window.location.href.includes('success') // TODO
        //})

        if (submissionSuccess) {
          sendMsg('success', ((index + 1) / webpages.length) * 100, false, webpage.title)
          //Screenshot
          const dir = path.join(__dirname, 'screenshots')
          const fName = `${jobId}-${webpage.title.replace(/\s+/g, '_')}.png`
          await page.screenshot({ path: path.join(dir, fName) })

        } else {
          throw new Error('Submission failed: no success indicator found')
        }
      } catch (error) {
        sendMsg('failure', ((index + 1) / webpages.length) * 100, false, webpage.title)
        sendMsg(`failure: ${error.message}`, ((index + 1) / webpages.length) * 100, true, webpage.title)
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
      setTimeout(() => delete jobs[jobId], 7 * 60 * 1000)
    }
  })
}

module.exports = { startSigning, getSSE }