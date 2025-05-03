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
    const style = `<link rel="stylesheet" href="./WebComponents/style.css">`

    const checkboxes = this.documents.map((x, i) => `
      <label class="full">
        <input type="checkbox" name="documentOptions" data-idx="${i}" ${x.selected ? 'checked' : ''}>
        ${x.title}
      </label>
    `).join('')

    this.shadowRoot.innerHTML = `
      ${style}
      <div class="container">
        <h3 class="header">Choose which documents to sign:</h3>
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
      this.dispatchEvent(new CustomEvent('completed', { detail: selectedDocs }))
    })

    this.shadowRoot.querySelector('.container').classList.add('hide')
    this.shadowRoot.querySelector('.container').classList.remove('show')
    setTimeout(() => {
      this.shadowRoot.querySelector('.container').classList.remove('hide')
      this.shadowRoot.querySelector('.container').classList.add('show')
    }, 100)
  }
}

customElements.define('document-selector', DocumentSelector)

export default DocumentSelector
