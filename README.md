# UnifiedSigning
Social tool contributing to AI risk reduction.  
This repo is an requested tool for bulk form signing of AI Risk related petitions/accords/statements/oaths/etc.

**Flow:**  
Step 1) Select forms to sign  
Step 2) Auto-build unified form  
Step 3) Submit & Wait (with progress updates) -> Completed: Manual form signing for failed  
It can take ten minutes to complete scrapping all sites and attempt auto-complete - basically a limitation of server web crawling.  

## Web access

[UnifiedSigning.xyz](https://unifiedsigning.xyz/)

Embed code:  
```
<iframe width="100%" height="100%" src="https://unifiedsigning.xyz/"></iframe>
```


## Dev

The tech stack is intended to be most-accessible for general collaboration - which meant using Javascript.  
I'm not given to dynamically-typed web tech (any F# devs up for collab?), so the styling will be less standard.  
Basically it means favoring:  
- Defining narrow functions first then composing them in a final function.  
- Variables/State being contained within a function that returns data (or functions) over mutations.
- Lambda arrow functions and dot function chaining (with single char variables).
- Constants, white-space formatting, less brackets and no semis!  \\(._. )  

__**data/individual.json**__

Data is provided via JSON file (full schema provided).
Schema got a little complex and I was banking on my free buddy Claude filling them out with less hand-holding.
Contact for new signing form additions.


### Frontend:

  - **Stack:** HTML, CSS, Javascript, Web Components, JSON  
Collaboration-friendly plain web tech that does not require framework knowledge.


  - **main.js**  
Entry point, sets up the higher-level state and form steps (the Web Components).


  - **/WebComponents**  
Each WebComponent is designed to be used programatically (rather than from HTML).  
Each encapsulate a step's logic & layout then feed data to the next step (in a more functional approach).  
Composed as: DocumentSelector -> DetailsForm -> AutoSigner  
CSS file is preloaded (in index.html), shared but referenced separately from each component.

  - **config.js**  
Just sets the server URL (only change if self-hosting).


### Backend:

  - **Stack:** Javascript, Node, Express, Puppeteer  
Simple node API with two routes:  
  __**/run**__ Starts form signing from frontend user submit. Returns a jobID.  
  __**/run/:jobID **__ Returns progress updates to frontend via Server-Sent Events(SSE).  

  - **backend/server.js**  
Entry point, sets up the node routes and SSE job in-memory persistence.


  - **backend/api.js**  
The puppeteer code that crawls sites, fills out input fields, submits forms and updates job progress.


  - **backend/config.js**  
Server deployment settings.  
*"/backend"* folder is hosted externally with modified */backend/config.js* file (ask for self-deployment help).


### Minification:

'''npm run minify'''


### Comments

Originally created or a specific site to use, hence the styling is what it is (will change if there enough interest).
Tech was constrained due to the target no-code site's embedding limitations not playing well with WebAssembly, as well as collaboration accessibility.

Initial assessment using a handful of sites, this seemed like a simple step-by-step iframe solution with auto-submit, auto-complete or manual for each form.
On deeper recurse, too many site CORS policies made it a no-go and a server solution was required. Despite that, several sites proved too trying for the effort.

This repo is not meant for vast traffic - if it becomes popular, further development and server costs are required.
