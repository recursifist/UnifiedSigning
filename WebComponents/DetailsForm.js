class DetailsForm extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.fields = new Array()
    this.fieldValues = new Object()
  }

  set fields(arr) {
    this._fields = arr
    this._initFieldValues()
    this.render()
  }
  get fields() {
    return this._fields || []
  }

  _initFieldValues() {
    this.fieldValues = this.fields.reduce((acc, field) => {
      switch (field.inputType) {
        case 'text':
          acc[field.id] = ''
          break
        case 'textarea':
          acc[field.id] = ''
          break
        case 'url':
          acc[field.id] = ''
          break
        case 'checkbox':
          acc[field.id] = false
          break
        default:
          acc[field.id] = field.inputType[0]
          break
      }
      return acc
    }, {})
  }

  connectedCallback() {
    this.render()
  }

  render() {
    const style = `<link rel="stylesheet" href="./WebComponents/style.css">`

    const fieldsHtml = this.fields.map((field) => {
      let result = ''
      const requiredIndicator = field.required ? "<i class='failureColor'>*</i>" : ""
      const webpageTitle = (field.id.startsWith('-')) ? `<div class="subheader">${field.title}</div>` : ''

      switch (field.inputType) {
        case 'text':
          // TODO Handle FullName split to First/Last
          result += `
            <label>
              ${webpageTitle}
              ${field.label}${requiredIndicator}
              <br>
              <input type="text" 
                name="${field.id}" value="${this.fieldValues[field.id] || ''}"
                ${field.id === 'email' ? `pattern='${`[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}$`}'` : ""}
                ${field.id === 'email' ? `placeholder='example@example.com'` : ""}
                required="${field.required}"
                />
            </label>
          `
          break
        case 'textarea':
          result += `
            <label class="full">
              ${webpageTitle}
              ${field.label}${requiredIndicator}
              <br>
              <textarea name="${field.id}" required="${field.required}">
                ${this.fieldValues[field.id] || ''}
              </textarea>
            </label>
          `
          break
        case 'url':
          result += `
            <label>
              ${webpageTitle}
              ${field.label}${requiredIndicator}
              <br>
              <input type="url" 
                name="${field.id}" value="${this.fieldValues[field.id] || ''}" 
                pattern="${`https?://.+`}"
                placeholder="https://"
                required="${field.required}"
                />
            </label>
          `
          break
        case 'checkbox':
          result += `
            <label class="full">
              ${webpageTitle}
              <input type="checkbox" name="${field.id}">
              <span class="checkbox-text">${field.label}</span>
            </label>
          `
          break
        default:
          if (Array.isArray(field.inputType)) {
            const subType = field.querySelector.includes('select') ? 'select' : 'radio'
            if (subType === 'select') {
              const options = field.inputType.map((item, ii) => `
                <option value="${item}" ${ii === 0 ? 'selected' : ''}>${item}</option>
              `).join('');
              result += `
                <label for="${field.id}">
                ${webpageTitle}
                ${field.label}<br>
                  <select name="${field.id}" id="${field.id}">
                    ${options}
                  </select>
                  ${webpageTitle}
                </label>`
            } else {
              const radios = field.inputType.map((item, ii) => `
              <label class='radio'>
                <input type="radio" name="${field.id}" value="${item}" data-radio-group="${field.id}" ${ii > 0 ? '' : 'checked'} >
                ${item}
              </label>
              `).join('')
              result +=
                `<label>
                <legend>
                  ${webpageTitle}
                  ${field.label}
                </legend>
                ${radios}
              </label>`
            }
          }
          break
      }
      return result
    }).join('')

    this.shadowRoot.innerHTML = `
      ${style}
      <div class="container">
      <form id="DetailsForm">
        <h3 class="header">Fill in your details:</h3>
        <div class="flex">
          ${fieldsHtml}
        </div>
        <button id="submit-button" type="submit">Submit</button>
      </form>
      </div>
    `

    this._addInputListeners()

    this.shadowRoot.getElementById('DetailsForm').onsubmit = (e) => {
      e.preventDefault()
      const testing = false
      const testData = {
        "full-name": "Jack Harrison",
        "email": "jharrison@gmail.com",
        "job-title": "Chief Researcher",
        "affiliation": "Ex-OpenAI",
        "country": "Denmark",
        "first-name": "Jack",
        "last-name": "Harrison",
        "field": "Other Notable Figures",
        "noteworthy-honors": "Nobel Winner",
        "country-nationality": "Denmark",
        "country-nationality2": "Denmark",
        "checkbox-notable-signatory": true,
        "entity": "Individual",
        "-consent-existential-safety-pledge": true,
        "-consent-international-ai-governance-petition": true,
        "-signature-url": "https://www.signature.com/jharrison",
        "-important-statement": "Safety does not care about positive outcomes.",
        "-extra-statement": "Safety isn't concerned over positive outcomes."
      }
      this.dispatchEvent(new CustomEvent('completed', { detail: testing ? testData : this.fieldValues }))
    }
  }

  _addInputListeners() {
    this.shadowRoot.querySelectorAll('input[type="text"], textarea').forEach(input => {
      input.onchange = (e) => {
        const name = e.target.getAttribute('name')
        this.fieldValues[name] = e.target.value
      }
    })

    this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.onchange = (e) => {
        const name = e.target.getAttribute('name')
        this.fieldValues[name] = e.target.checked
      }
    })

    this.shadowRoot.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', (e) => {
        const group = e.target.getAttribute('name')
        this.fieldValues[group] = e.target.value
      })
    })

    this.shadowRoot.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.onchange = (e) => {
        const group = e.target.getAttribute('name')
        this.fieldValues[group] = e.target.value
      }
    })

    this.shadowRoot.querySelector('.container').classList.add('hide')
    this.shadowRoot.querySelector('.container').classList.remove('show')
    setTimeout(() => {
      this.shadowRoot.querySelector('.container').classList.remove('hide')
      this.shadowRoot.querySelector('.container').classList.add('show')
    }, 100)
  }
}

customElements.define('details-form', DetailsForm)

export default DetailsForm
