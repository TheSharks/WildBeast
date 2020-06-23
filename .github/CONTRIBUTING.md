**Thank you for taking the time to contribute to the development of WildBeast!**

Please follow these rules when making contributions to this repository.

# Source code

## Unwanted contributions

1. Changes to ESLint configuration without justifiable reason
2. New commands that are confusing to use for end users
3. Breaking changes to already existing commands, unless strictly necessary 
4. Unnecessarily large restructurings of code

## Code rules

### Verified as working

All code contributed to this repository should be verified as working, meaning you've tested the functionality at least once and didn't encounter unexpected behaviour.   
Please keep in mind that we might ask you to confirm if this is the case.

### ESLint

ESLint handles our style enforcement, when making contributions, **please confirm your code adheres to the style**, your build will fail otherwise and we're less inclined to merge it.   
To verify your code adheres to our styleguide, run `npm test` in the project root.

## Code practices

### Database operations

When performing database operations, **don't import a driver and call it directly**, instead, require `database-selector.js` and write abstractions.   
When writing abstractions, you only need to write them for the officially supported database at that time. (currently ArangoDB)

### Global objects

Avoid polluting the global namespace unnecessarily, if something is not likely to be frequently used across the project, don't add it.   

### Promises and async

**Always** chain promises where possible.   

```js
// ✗ bad
aPromise().then(result => {
 anotherPromise(result).then(anotherresult => {
   console.log(anotherresult)
 }).catch(console.error)
}).catch(console.error)
```

```js
// ✓ good
aPromise().then(result => {
 return anotherPromise(result)
}).then(anotherresult => {
 console.log(anotherresult)
}).catch(console.error)
```

```js
// ✓ even better
aPromise().then(async result => {
  const anotherresult = await anotherPromise(result)
  console.log(anotherresult)
}).catch(console.error)
```

```js
// 💯 great!
(async () => { // top-level async is used as an example, its not required
  try {
    const result = await aPromise()
    const anotherresult = await anotherPromise(result)
    console.log(anotherresult)
  } catch (e) { 
    console.error(e) 
  }
})()
```

# Docs

## General contribution rules

* Additions should be committed to a **docs/<your-changes-title\>** branch and PRed to the experimental branch.
* Strive to submit grammatically correct changes.
* Do not commit or PR to the **gh-pages** branch. The **gh-pages** branch is handled by our CI.
* Follow the overall format in the docs.
* Do not add extraneous material such as screenshots.
* New pages must be added to the navbar in [mkdocs.yml](../docs/mkdocs.yml). See [DOCS_GUIDE.md](DOCS_GUIDE.md) for more details.

## Unwanted contributions

* Unnecessary restructurations of the docs.
* Untested changes (Changes must be verified as working)
* Configuration changes, except when changes are necessary for the documentation to work properly.

## Wanted contributions

Anything not outlined in the above section is considered wanted.
