**Thank you for taking the time to contribute to the development of WildBeast!**

Please follow these rules when making contributions to this repository.

# Contribution rules

## Unwanted contributions

1. Style violations fixes
2. ESLint rules changes
3. Alias additions (Only applies if no new commands are provided)

## Wanted contributions

We welcome all contributions that aren't unwanted by the rules defined above.

# Code rules

## Verified working

All code contributed to this repository should be verified working, meaning you've tested the functionality at least once and didn't encounter unexpected behaviour.   
Please keep in mind that we might ask you to confirm if this is the case.

## ESLint

ESLint handles our style enforcement, when making contributions, **please confirm your code adheres to the style**, your build will fail otherwise and we're less inclined to merge it.   
To verify your code adheres to our styleguide, run `npm test` in the project root.

## Best practises

### Database operations

When performing database operations, **don't import a driver and call it directly**, instead, require `database-selector.js` and write abstractions.   
When writing abstractions, you only need to write them for the officially supported database at that time. (currently ArangoDB)

### Global objects

Avoid polluting the global namespace unnecessarily, if something is not likely to be frequently used across the project, don't add it.   
When calling global objects, call them as you would a non-global object, for example: `global.logger.log('Hello world!')`.

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
})
```
