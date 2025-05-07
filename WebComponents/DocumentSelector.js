class DocumentSelector extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.documents = new Array()
  }

  set documents(arr) {
    this._documents = arr
    this.render()
  }
  get documents() {
    return this._documents
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

    const checkboxes = this.documents.map((x, i) => `
      <label class="full">
        <div class="flex">
          <div>
            <input type="checkbox" name="documentOptions" data-idx="${i}" ${x.selected ? 'checked' : ''}>
          </div>
          <div class="description">
            ${x.title}
            <div>${x.description || ''}
            <a class="sublink" href="${x.url}" target="_blank" rel="noopener noreferrer">Read more⇾</a>
            </div>
          </div>
        </div>
      </label>
    `).join('')

    this.shadowRoot.innerHTML = `
      ${style}
      <div class="container loading">
        <h3 class="header">
        Choose which documents to sign:
        </h3>
        
        <div>
          ${checkboxes}
        </div>
        <button id="submit-button">Next</button>
      </div>
    `

    this.shadowRoot.querySelectorAll('input[type="checkbox"][name="documentOptions"]')
      .forEach(checkbox => {
        checkbox.onchange = (e) => {
          const idx = e.target.getAttribute('data-idx')
          this.documents[idx].selected = e.target.checked
        }
      })

    this.shadowRoot.getElementById('submit-button').addEventListener('click', () => {
      const selectedDocs = this.documents.filter(s => s.selected).map(d => d.title)
      if(selectedDocs.length < 1) return
      this.dispatchEvent(new CustomEvent('completed', { detail: selectedDocs }))
    })

  }
}

customElements.define('document-selector', DocumentSelector)

export default DocumentSelector
