class DetailsForm extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.fields = new Array()
    this.details = new Object()
  }

  set fields(arr) {
    this._fields = this.sortFields(arr)
    this._initfieldDetails()
    this.render()
  }
  get fields() {
    return this._fields || []
  }

  _initfieldDetails() {
    this.details = this.fields.reduce((acc, field) => {
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

  sortFields(arr) {
    const priorityOrder = ['full-name', 'first-name', 'last-name', 'email', 'job-title', 'affiliation']

    arr.sort((a, b) => {
      const getPriority = (item) => {
        if (item.id.startsWith('-')) return 1000
        const idx = priorityOrder.indexOf(item.id)
        if (idx !== -1) return idx
        if (item.id.includes('country')) return priorityOrder.length
        return priorityOrder.length + 1
      }

      const prioA = getPriority(a)
      const prioB = getPriority(b)

      if (prioA !== prioB) return prioA - prioB

      if (prioA === 1000) {
        const titleA = a.title || '';
        const titleB = b.title || '';
        return titleA.localeCompare(titleB);
      }

      return a.id.localeCompare(b.id)
    })

    return arr
  }

  hasFirstLastNames() {
    return this.fields.some(x => ['first-name', 'last-name'].includes(x.id))
  }

  hasFullName() {
    return this.fields.some(x => x.id === 'full-name')
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
      <link rel="stylesheet" href="./WebComponents/style.css">
    `

    let lastWebpageTitle = ''
    const fieldsHtml = this.fields.map((field) => {
      let result = ''
      const requiredIndicator = field.required ? "<i class='failureColor'>*</i>" : ""
      const webpageTitle = (field.id.startsWith('-')) ? `<div class="subheader">${field.title}</div>` : ''

      if (webpageTitle.length > 0 && lastWebpageTitle !== webpageTitle) {
        lastWebpageTitle = webpageTitle
        result += `<label class="full bottom">${webpageTitle}</label>`
      }

      switch (field.inputType) {
        case 'text':
          if (field.id === 'full-name') {
            if (this.hasFirstLastNames()) { }
            else {
              result += `
                <label>
                  First Name ${requiredIndicator}
                  <br>
                  <input type="text" name="first-name" ${field.required ? 'required="true"' : ''} />
                </label>
                <label>
                  Last Name ${requiredIndicator}
                  <br>
                  <input type="text" name="last-name" ${field.required ? 'required="true"' : ''} />
                </label>
              `
            }
          } else {
            result += `
              <label>
                ${field.label}${requiredIndicator}
                <br>
                <input type="text" 
                  name="${field.id}" value="${this.details[field.id] || ''}"
                  ${field.id === 'email' ? `pattern='${`[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}$`}'` : ""}
                  ${field.id === 'email' ? `placeholder='example@example.com'` : ""}
                  ${field.required ? 'required="true"' : ''}
                  />
              </label>
          `
          }
          break
        case 'textarea':
          result += `
            <label class="full">
              ${field.label}${requiredIndicator}
              <br>
              <textarea name="${field.id}" ${field.required ? 'required="true"' : ''}>
                ${this.details[field.id] || ''}
              </textarea>
            </label>
          `
          break
        case 'url':
          result += `
            <label>
              ${field.label}${requiredIndicator}
              <br>
              <input type="url" 
                name="${field.id}" value="${this.details[field.id] || ''}" 
                pattern="${`https?://.+`}"
                placeholder="https://"
                ${field.required ? 'required="true"' : ''}
                />
            </label>
          `
          break
        case 'checkbox':
          result += `
            <label class="full">
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
                ${field.label}<br>
                  <select name="${field.id}" id="${field.id}">
                    ${options}
                  </select>
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
      const testData =
      {
        "full-name": "A. Turing",
        "first-name": "A.",
        "last-name": "Turing",
        "email": "demo@test.com",
        "country": "Norway",
        "country-nationality": "Canada",
        "country-nationality2": "Canada",
        "affiliation": "-",
        "entity": "Individual",
        "field": "AI Scientists",
        "job-title": "Software Developer",
        "noteworthy-honors": "-",
        "-consent-existential-safety-pledge": true,
        "-consent-international-ai-governance-petition": true,
        "-consent-petition-wins-ban-superintelligence": "No",
        "-consent-petition-wins-time-running": "No",
        "-consent-petition-wins-us-must": "No",
        "-extra-statement": "",
        "-important-statement": "",
        "-not-public-ban-superintelligence": false,
        "-not-public-time-running": false,
        "-not-public-us-must": false,
        "-signature-url": ""
      }
      this.dispatchEvent(new CustomEvent('completed', { detail: testing ? testData : this.details }))
    }
  }

  _addInputListeners() {
    this.shadowRoot.querySelectorAll('input[type="text"], textarea').forEach(input => {
      input.onchange = (e) => {
        const name = e.target.getAttribute('name')
        if (['first-name', 'last-name'].includes(name) && this.hasFullName()) {
          const first = this.shadowRoot.querySelector('input[name="first-name"')?.value
          const last = this.shadowRoot.querySelector('input[name="last-name"')?.value
          this.details['full-name'] = first + " " + last
        }
        this.details[name] = e.target.value
      }
    })

    this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.onchange = (e) => {
        const name = e.target.getAttribute('name')
        this.details[name] = e.target.checked
      }
    })

    this.shadowRoot.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', (e) => {
        const group = e.target.getAttribute('name')
        this.details[group] = e.target.value
      })
    })

    this.shadowRoot.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.onchange = (e) => {
        const group = e.target.getAttribute('name')
        this.details[group] = e.target.value
      }
    })
  }
}

customElements.define('details-form', DetailsForm)

export default DetailsForm
