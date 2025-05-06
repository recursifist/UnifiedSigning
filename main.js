import utils from "./utils.js"
import "./WebComponents/DocumentSelector.js"
import "./WebComponents/DetailsForm.js"
import "./WebComponents/AutoSigner.js"

let $container = undefined
let $entityName = 'individual'
let $webpages = new Array()
let $selected = new Array()

const createContainer = () => {
  const container = document.createElement('div')
  container.token = 'UnifiedSigningContainer'

  const root = document.getElementById("UnifiedSigningRoot")
  root.appendChild(container)

  return container
}

const createStep = (init, onDone) => {
  const element = init()
  element.addEventListener('completed', (event) => {
    element.hidden = true
    onDone(event.detail)
  })
  $container.appendChild(element)
}

const docSelectorStep = (onDone) => {
  const init = () => {
    const docSelector = document.createElement('document-selector')
    docSelector.documents = $webpages.map(x => ({ title: x.title, url: x.url, selected: true }))
    return docSelector
  }
  createStep(init, onDone)
}

const detailsFormStep = (onDone) => {
  return (selectedDocs) => {
    const init = () => {
      const detailsForm = document.createElement('details-form')
      $selected = selectedDocs
      detailsForm.fields = $webpages
        .filter(w => selectedDocs.includes(w.title))
        .filter(w => w.auto !== 'none')
        .flatMap(w =>
          w.fields.map(f => ({
            ...f,
            title: w.title
          }))
        )
        .flat(1)
        .filter((x, i, self) => i === self.findIndex((t) => t.id === x.id))
        .sort((a, b) => {
          const aa = a.id.startsWith('-')
          const bb = b.id.startsWith('-')
          if (aa === bb) return 0
          return aa ? 1 : -1
        })
      return detailsForm
    }
    createStep(init, onDone)
  }
}

const autoSignerStep = () => {
  return (details) => {
    const init = () => {
      const autoSigner = document.createElement('auto-signer')
      autoSigner.webpages = $webpages
        .filter(w => $selected.includes(w.title))
        .map(w => ({ title: w.title, url: w.url }))
      autoSigner.documents = $selected
      autoSigner.details = details
      autoSigner.entity = $entityName
      autoSigner.run()
      autoSigner.addEventListener('retry', (documentsToRetry) => {
        // Retry unsuccessful documents
        autoSigner.documents = autoSigner.documents.filter(x => documentsToRetry.includes(x.title))
        autoSigner.run()
      })
      return autoSigner
    }
    createStep(init, () => { })
  }
}

const doStepFlow = utils.compose(docSelectorStep, detailsFormStep, autoSignerStep)

const load = (entityName) => utils.onReady(async () => {
  $entityName = entityName
  $webpages = await utils.loadData(entityName)
  $container = createContainer()
  doStepFlow()
})

export default {
  load
}
