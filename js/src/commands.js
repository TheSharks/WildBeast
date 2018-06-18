// Tool to dynamically generate command documentation

function generateCommandDocs (commandInfo) {
  if (commandInfo) { // Only run if commandInfo is defined to prevent unexpected results
    if (window.location.pathname === '/commands/') { // Only run if in the commands doc
      const commandCategories = extractCategories(commandInfo)
      const globalContainer = document.getElementById('commands-table')

      commandCategories.forEach(cmdCat => {
        // Create header
        const h3 = document.createElement('h3')
        h3.setAttribute('id', cmdCat.toLowerCase())
        h3.innerHTML = cmdCat

        // Create table
        const commandsInCategory = extractCommandsFromCategory(commandInfo, cmdCat)

        // Only proceed if there are commands in the category (Avoids "ghost tables")
        if (commandsInCategory && commandsInCategory.length > 0) {
          const table = generateHTMLTable(commandsInCategory)

          globalContainer.appendChild(h3)
          globalContainer.appendChild(table)
        }
      })
    }
  }
}

// Extract categories from all commands
function extractCategories (commandInfo) {
  const categories = []

  for (const command in commandInfo) {
    const category = commandInfo[command].module || 'Uncategorised'
    if (!categories.includes(category)) categories.push(category)
  }

  return categories
}

function extractCommandsFromCategory (commandInfo, categoryToExtract) {
  const commandsInCategory = []

  for (const cmd in commandInfo) {
    if (!commandInfo[cmd].doNotDocument) { // Ignore commands marked as non-documented
      commandInfo[cmd].name = cmd // Allows later tracking of command name
      const categoryOfCommand = commandInfo[cmd].module || 'Uncategorised'
      if (categoryOfCommand === categoryToExtract) commandsInCategory.push(commandInfo[cmd])
    }
  }

  return commandsInCategory
}

// Generate a table for a category
function generateHTMLTable (commandsInCategory) {
  const table = document.createElement('table')

  const header = constructHeader()
  const body = constructBody(commandsInCategory)

  table.insertAdjacentElement('afterbegin', header)
  table.insertAdjacentElement('beforeend', body)

  return table
}

// Construct the table header
function constructHeader () {
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')

  const headers = [
    'Name',
    'Description',
    'Usage',
    'Level',
    'Required permissions'
  ]

  // Construct header row
  headers.forEach(header => {
    const th = document.createElement('th')
    th.innerHTML = header
    headerRow.insertAdjacentElement('beforeend', th)
  })

  thead.appendChild(headerRow)

  // Append
  return thead
}

// Construct the table body
function constructBody (commands) {
  const tbody = document.createElement('tbody')

  // Construct a row per command
  commands.forEach(cmdObj => {
    const tr = document.createElement('tr')

    const usage = cmdObj.usage ? `${cmdObj.name} ${sanitiseUsage(cmdObj.usage)}` : ' '
    const rowContent = `<td><b>${cmdObj.name}</b></td><td>${cmdObj.help}</td><td>${usage}</td><td>${cmdObj.level || '0'}</td><td>${cmdObj.permAddons || ' '}</td>`
    tr.innerHTML = rowContent

    // Append
    tbody.insertAdjacentElement('beforeend', tr)
    return tbody
  })

  return tbody
}

function sanitiseUsage (usageString) {
  if (!usageString) return ' '

  // Escape tags
  usageString = usageString.replace('<', '&lt;').replace('>', '&gt;')

  return usageString
}

// Run
generateCommandDocs()

// DO NOT TOUCH ANYTHING BELOW THIS - MANAGED BY CI
