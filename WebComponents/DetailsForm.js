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
    const style = `
      <style>
        .preLine {
          white-space: pre-line;
        }
        input[type="checkbox"] span {
        }
      </style>
    `

    const fieldsHtml = this.fields.map((field) => {
      const requiredIndicator = field.required ? "<i>*</i>" : ""
      switch (field.inputType) {
        case 'text':
          return `
            <label>
              ${field.label}${requiredIndicator}
              <br>
              <input type="text" required="${field.required}" name="${field.id}" value="${this.fieldValues[field.id] || ''}"/>
            </label>
          `
        case 'textarea':
          return `
            <label>
              ${field.label}${requiredIndicator}
              <br>
              <textarea required="${field.required}" name="${field.id}">${this.fieldValues[field.id] || ''}</textarea>
            </label>
          `
        case 'checkbox':
          return `
            <label>
              <div>
                <input type="checkbox" name="${field.id}">
                <span class="preLine">${field.label}</span>
              </div>
            </label>
          `
        default:
          if (Array.isArray(field.inputType)) {
            const subType = field.querySelector.includes('select') ? 'select' : 'radio'
            if (subType === 'select') {
              const options = field.inputType.map((item, ii) => `
                <option value="${item}" ${ii === 0 ? 'selected' : ''}>${item}</option>
              `).join('');
              return `
                <label for="${field.id}">${field.label}</label><br>
                <select name="${field.id}" id="${field.id}">
                  ${options}
                </select><br>`
            } else {
            const radios = field.inputType.map((item, ii) => `
              <label>
                ${item}
                <input type="radio" name="${field.id}" value="${item}" data-radio-group="${field.id}" ${ii > 0 ? '' : 'checked'} >
              </label><br>
            `).join('')
            return `<legend>${field.label}</legend>${radios}`
            }
          }
          return ''
      }
    }).join('<br>')

    this.shadowRoot.innerHTML = `
      ${style}
      <form id="DetailsForm">
        <p class="framer-text">Fill in your details:</p>
        <div>
          ${fieldsHtml}
        </div>
        <br>
        <button id="submit-button" type="submit">Start</button>
      </form>
    `

    this._addInputListeners()

    this.shadowRoot.getElementById('DetailsForm').onsubmit = (e) => {
      e.preventDefault()
      //Validation
      this.dispatchEvent(new CustomEvent('completed', { detail: this.fieldValues }))
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
  }
}

customElements.define('details-form', DetailsForm)

export default DetailsForm
