const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const api = require('./api')
const config = require('./config')
const app = express()

app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())

// In-memory job storage
const jobs = {}

const generateJobId = () => {
  const randomBytes = crypto.randomBytes(4)
  const randomSuffix = Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
  return `job-${Date.now()}-${randomSuffix}`
}

// Routes
app.get('/', (_req, res) => res.status(200).send('API online'))

app.post('/run', (req, res) => {
  const jobId = generateJobId()
  
  jobs[jobId] = {
    status: 'pending',
    messages: [],
    queue: [],
    startedAt: new Date(),
  }
  
  Promise.resolve().then(async () => {
    try {
      await api.startSigning(req, jobId, jobs)
    } catch (error) {
      const errorMsg = { 
        message: `Unhandled error: ${error.message}`, 
        progress: 0, 
        error: true 
      }
      
      jobs[jobId].messages.push(errorMsg)
      jobs[jobId].status = 'error'
      
      jobs[jobId].queue.forEach(client => {
        client.write(`data: ${JSON.stringify(errorMsg)}\n\n`)
      })
    }
  })
  
  res.json({ jobId })
})

app.get('/run/:jobId', (req, res) => {
  const { jobId } = req.params
  api.getSSE(req, res, jobId, jobs)
})

app.listen(config.port, () => console.log('Ready on port ' + config.port))