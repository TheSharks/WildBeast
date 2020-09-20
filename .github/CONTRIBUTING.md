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

### Translations

All user-facing text, meaning text that gets send to Discord and is displayed to end-users, needs to be included in the i18n framework.   
The `i18n` object is globally accessible throughout the project, so don't require it separately.    
The framework utilises ICU syntax for translations, a primer for this syntax can be found [here](https://formatjs.io/docs/core-concepts/icu-syntax).

```js
// ✗ bad
msg.channel.createMessage(`Hi there ${user.name}!`)
```

```js
// ✓ good
msg.channel.createMessage(i18n.t('user.greeting', { name: user.name }))
```

### Database operations

We use Knex as our SQL driver, and we write abstractions in the form of drivers for each moving part that requires database access.   
When something requires database access and does not already have a driver, **do not directly import Knex, make a driver instead**   
When writing Knex abstractions, your abstractions should provide support for the databases we support officially, namely SQLite and PostgreSQL

### Sending messages with commands

When sending messages, send them using `<Command>.safeSendMessage()`. This will check whether or not the client has permissions to send messages in the channel before trying to send them. Calling `<TextChannel>.createMessage()` directly is discouraged.

```js
// ⚠ avoid
new Command(async function (msg) {
  await msg.channel.createMessage('Hello world!')
})
```

```js
// ✓ prefered
new Command(async function (msg) {
  await this.safeSendMessage(msg.channel, 'Hello world!')
})
```

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
