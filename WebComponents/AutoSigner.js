import config from '../config.js'

class AutoSigner extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._webpages = []
    this._documents = []
    this._details = undefined
    this._entity = 'individual'
    this._index = 1
    this._results = []
    this._message = ''
    this._showRetry = false
    this._loading = true
  }

  set webpages(arr) {
    this._webpages = arr
  }
  get webpages() {
    return this._webpages
  }

  set documents(arr) {
    this._documents = arr
    this._results = arr.map(title => ({ title, value: undefined }))
    this.render()
  }
  get documents() {
    return this._documents
  }

  set details(obj) {
    this._details = obj
  }
  get details() {
    return this._details
  }

  set entity(val) {
    this._entity = val
  }
  get entity() {
    return this._entity
  }

  set index(val) {
    this._index = val
    this.render()
  }
  get index() {
    return this._index
  }

  set results(val) {
    this._results = val
    this.render()
  }
  get results() {
    return this._results
  }

  set message(val) {
    this._message = val
    this.render()
  }
  get message() {
    return this._message
  }

  set showRetry(val) {
    this._showRetry = val
    this.render()
  }
  get showRetry() {
    return this._showRetry
  }

  set loading(val) {
    this._loading = val
    this.render()
  }
  get loading() {
    return this._loading
  }

  async run() {
    try {
      this.resetUIState()
      const apiUrl = config.server + 'run'
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected: this.documents,
          details: this.details,
          entity: this.entity
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`[UnifiedSigner] API error: ${response.status} ${errorText}`)
      }

      const { jobId } = await response.json()
      if (!jobId) throw new Error('[UnifiedSigner] No job ID received from server')

      const sseUrl = `${apiUrl}/${jobId}`
      const source = new EventSource(sseUrl)
      let attempts = 0
      const maxAttempts = 3

      source.onmessage = (event) => {
        try {
          attempts = 0
          this.handleMessage(event, source)
        } catch (error) {
          console.error('[UnifiedSigner] Error parsing SSE message:', error)
        }
      }

      source.onerror = (error) => {
        console.error('[UnifiedSigner] SSE connection error:', error)

        if (attempts >= maxAttempts) {
          this.message = 'Failed - connection error. Please try again.'
          this.showRetry = true
          this.loading = false

          source.close()
          this._currentEventSource = null
          return
        }

        attempts++
        console.error(`Connection lost. Reconnecting (${attempts}/${maxAttempts})...`)

        setTimeout(() => {
          if (source.readyState === EventSource.CONNECTING) {
            this.message = 'Failed - connection error. Please try again.'
            this.showRetry = true
            this.loading = false

            source.close()
          }
        }, 5000)

      }

      this._currentEventSource = source

    } catch (error) {
      this.message = 'Failed - server error. Please try again.'
      this.showRetry = true
      this.loading = false
      console.error('[UnifiedSigner] Error running job:', error)
    }

  }

  resetUIState() {
    this.message = `Starting auto-signing...`
    this.showRetry = false
    this.loading = true
    this.index = 0
    this.results = this.documents.map(title => ({ title, value: undefined }))
  }

  handleMessage(event, source) {
    const data = JSON.parse(event.data)
    switch (data.message) {
      case "processing":
        if (data.title) {
          this.message = `Signing: ${data.title}`
          const resultItem = this.results.find(x => x.title === data.title)
          if (resultItem) resultItem.value = data.message
          this.index = this.index + 1
        }
        break

      case "success":
        if (data.title) {
          const resultItem = this.results.find(x => x.title === data.title)
          if (resultItem) resultItem.value = data.message
        }
        break

      case "failure":
        if (data.title) {
          const resultItem = this.results.find(x => x.title === data.title)
          if (resultItem) resultItem.value = data.message
        }
        break

      case "complete":
        this.showRetry = false
        this.loading = false
        this.message = this.results.every(x => x.value === 'success')
          ? 'Finished.'
          : 'Finished, some manual signing is required.'
        this.index = this.documents.length

        source.close()
        break

      default:
        if (data.error) {
          this.message = 'Failed. Please try again.'
          this.showRetry = true
          this.loading = false

          if (data.title) {
            console.error(`[${data.title}] ${data.message}`)
          } else {
            console.error(`[UnifiedSigner] ${data.message}`)
          }
        }
        break
    }

    this.render()
  }

  showEmailNote() {
    this.results.some(x => x.value === "success")
  }

  connectedCallback() {
    this.render()
  }

  render() {
    const style = `
      <style>
      .loading * {
          opacity: 0;
          transition: opacity 1s ease;
        }
      </style>
      <link rel="stylesheet" href="./WebComponents/style.min.css">
    `

    const statusIcon = (index, url) => {
      const result = this.results[index].value
      switch (result) {
        case "processing": return "<span class='status-icon bulletLoading'></span>"
        case "failure": return "<span class='status-icon'>✗</span>"
        case "success": return `<span class='status-icon'>✔</span>`
        default: return "<span class='status-icon bullet'></span>"
      }
    }
    const statusMessage = (index, url) => {
      const result = this.results[index].value
      switch (result) {
        case "failure": return `<br><span class="status-icon"> </span>
        <a class="sublink" href="${url}" target="_blank" rel="noopener noreferrer">Click to sign it manually ⇾</a>`
        default: return ''
      }
    }

    const progressList =
      "<ul>" +
      this.webpages.map((w, i) => {
        return `<li>
            ${statusIcon(i)}
            ${w.title}
            ${statusMessage(i, w.url)}
          </li>`
      }).join('') +
      "</ul>"

    this.shadowRoot.innerHTML = style +
      `<div class="container loading">
        <h3 class="header">
          (${Math.min(this.index, this.documents?.length)}/${this.documents?.length})
          ${this.message}
          ${this.loading
        ? `<div class="subheader">
                <div class="loader"></div>
                The process may take several minutes - don't close this window. 
              </div>`
        : ''
      }
        </h3>
        <div>
            ${progressList}
            ${this.showEmailNote() ? `<br><i class="subheader">May require email verification, please check your email.</i><br>` : ''}
            <div id="retryContainer" ${this.showRetry ? '' : `class="hidden"`}">
              <button id="retryButton">Retry</button>
            <div>
        </div>
      </div>`


    this.shadowRoot.getElementById('retryButton').addEventListener('click', (e) => {
      e.target.disabled = true
      const retryDocuments = this.results
        .filter(x => ((typeof x.value) === "undefined") || ["processing", "failure"].includes(x.value))
        .map(x => x.title)
      setTimeout(() => {
        this.dispatchEvent(new CustomEvent('retry', { detail: retryDocuments }))
      }, 1500)
    })

  }
}

customElements.define('auto-signer', AutoSigner)

export default AutoSigner