import config from './config.js'

export default {
  onReady: (callback) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(callback, 1)
    } else document.addEventListener("DOMContentLoaded", callback)
  },
  loadData: async (entityName) => {
    const t = Date.now()
    const response = await fetch(`./data/${entityName}.json?t=${t}`)
    const jsonData = await response.json()
    return jsonData.webpages
  },
  compose: (...funs) => (arg) => funs.reduceRight((acc, fun) => fun(acc), arg)
}