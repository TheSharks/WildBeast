First off, thanks for taking the time to contribute!  
The following are a set of guidelines to improve the quality of your contributions, please follow them accordingly.  

# Pull requests   
1. All pull requests are welcome, but you are required to version bump `package.json` and `README.md`.     
2. You are required to confirm that you've tested your code.  
3. Guideline 2 does not apply on, but is not limited to; spelling/grammar improvements, small tweaks and image additions.  
4. Please do not change `CHANGELOG.md`, this is reserved for contributors with write access.

# Issues  
1. If submitting a bug report, include any log files (excluding chatlogs) with your issue.  
2. If submitting a improvement suggestion, explain why you want this feature included, you don't have to go into details.  
3. Please do not open issues if you're not sure about the cause of the problem.

# Code guidelines
1. All commands go in `commands.js`, no exceptions.
2. Additional files needed by commands go in the `runtime` folder, with the exception for images and music.
3. Usage of ES6 code is allowed.
4. You are free to require additional node modules, but include them in `package.json` if you do.
5. When adding something users would like to disable/enable, include a `config.json` value that will trigger/disable the function.
6. When calling the bots name, use `bot.user` or `bot.user.username`, and not WildBeast or DougleyBot.
7. Try to modulate as much of your code as possible, for example; if your code needs a rss feed, try to modulate the calling for the feed.
