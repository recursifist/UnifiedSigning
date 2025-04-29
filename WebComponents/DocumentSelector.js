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
      </style>
    `

    const checkboxes = this.documents.map((x, i) => `
      <label>
        <input type="checkbox" name="documentOptions" data-idx="${i}" ${x.selected ? 'checked' : ''}>
        ${x.title}
      </label>
    `).join('<br>')

    this.shadowRoot.innerHTML = `
      ${style}
      <div>
        <p class="framer-text">Choose which documents to sign:</p>
        <div>
          ${checkboxes}
        </div>
        <br>
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
        this.dispatchEvent(new CustomEvent('completed', { detail: selectedDocs }))
      })
  }
}

customElements.define('document-selector', DocumentSelector)

export default DocumentSelector
