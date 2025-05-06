const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const config = require('./config')
const api = require('./api')
const app = express()
const logger = require('./logger')

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  exposedHeaders: ['Content-Type', 'Connection', 'Cache-Control']
}))

app.options('*all', cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}))

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

app.post('/run', async (req, res) => {
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

app.use((err, req, res, next) => {
  logger.error(`Error [${req.method}]: ${err.message}`)
  res.status(500).json({ error: 'Server error', message: err.message })
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`)
  process.exit(1)
})