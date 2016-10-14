**Thank you for taking the time to contribute to the development of WildBeast!**
Please follow these rules when making contributions to this repository.

# Contribution rules
## Unwanted contributions
1. Spelling/Grammar changes (Managed internally)
2. Style violations fixes (Managed internally)
3. ESLint rules changes
4. Custom command issues (Except problems **within** the command framework itself)
5. Alias additions (Only applies if no new default commands are provided)
6. Issues stemming from usage of normal user accounts instead of OAuth bot accounts

## Wanted contributions
Everything that doesn't fit in the unwanted category is wanted :eyes: :thumbsup: 

# Notes
## Commands
Make sure that the commands you're adding are suitable to be default commands and packaged within for instance WildBot. If you think that some commands are better off as custom ones, don't submit them but instead introduce them to your own instance. Given that you have one, of course.

## When writing, keep the styleguide in mind
1. We follow the [JavaScript Standard Style](https://github.com/feross/standard), please format your code according to that.
2. [ESLint](http://eslint.org/) is used to identify other style violations.

# Before you PR
If you have gotten far enough to pull request (Written the code edits etc.) and have it all ready, do a few things first.

1. Test your code. This means attempting to run a WildBeast instance with your edited code, if you have your own instance to test with. This is recommended as even partially broken code can be already identified here before running styleguide checks.
2. Run the command `npm test` in the bot's folder to "lint" the code using ESlint. If it finds violations, fix them before continuing.
3. Run the command `standard` in the same directory as above to test for JS Standard Code Style violations. Again, if violations are found, fix them before proceeding.

When all the above give you a green light, you can consider yourself free to make the pull request!

**NOTE:** Pull requests that break the rules provided above **will be rejected!**
