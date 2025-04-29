import config from '../config.js'

class AutoSigner extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._documents = []
    this._details = undefined
    this._entity = 'individual'
    this._index = 1
    this._results = []
    this._message = ''
  }

  set documents(arr) {
    this._documents = arr
    this._results = arr.map(title => ({ title, value: null }))
    this.render()
  }
  get documents() {
    return this._documents
  }

  set details(arr) {
    this._details = arr
  }
  get details() {
    return this._details
  }

  set entity(arr) {
    this._entity = arr
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
  
  async run() {
    const apiUrl = config.server + 'run'

    try {
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
      if (!jobId) {
        throw new Error('[UnifiedSigner] No job ID received from server')
      }

      this.message = 'Starting...'

      const sseUrl = `${apiUrl}/${jobId}`
      const source = new EventSource(sseUrl)

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.message) {
            case "processing":
              if (data.title) {
                this.message = `Signing: ${data.title}`
              }
              break

            case "success":
              if (data.title) {
                const resultItem = this.results.find(x => x.title === data.title)
                if (resultItem) resultItem.value = true
              }
              break

            case "failure":
              if (data.title) {
                const resultItem = this.results.find(x => x.title === data.title)
                if (resultItem) resultItem.value = false
              }
              break

            case "complete":
              this.message = `Finished!`
              this.index = this.index + 1

              source.close()
              break

            default:
              if (data.error) {
                this.message = data.message || 'An error occurred'

                if (data.title) {
                  console.error(`[${data.title}] ${data.message}`)
                } else {
                  console.error(`[UnifiedSigner] ${data.message}`)
                }
              }
              break
          }

          this.render()

        } catch (parseError) {
          console.error('[UnifiedSigner] Error parsing SSE message:', parseError)
        }
      }

      // Handle connection errors
      source.onerror = (err) => {
        console.error('[UnifiedSigner] SSE connection error:', err)

        this.message = 'Connection lost'

        source.close()
      }

      this._currentEventSource = source

    } catch (error) {
      this.message = error.message || 'Failed to start process'
      console.error('[UnifiedSigner] Error running job:', error)
    }
  }

  connectedCallback() {
    this.render()
  }

  render() {
    const style = `
      <style>
        ul { padding-left:0; list-style-type: none; }
        .successColor { color:green; }
        .failureColor { color:red; }
      </style>
    `

    const statusMark = (index) => {
      const result = this.results[index].value
      if (result === true) return "<span class='successColor'>✔</span>"
      else if (result === false) return "<span class='failureColor'>✗</span>"
      else return ""
    }

    const progressList =
      "<ul>" +
        this.documents.map((x, i) => `<li>${x} ${statusMark(i)}</li>`).join('') +
      "</ul>"

    this.shadowRoot.innerHTML = style +
      `<div>
        <div>
          <span>[${Math.min(this.index, this.documents?.length)}/${this.documents?.length}]</span>
          ${this.message}
        </div>
        ${progressList}
      </div>`
  }
}

customElements.define('auto-signer', AutoSigner)

export default AutoSigner