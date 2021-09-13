import { languages } from '../cache'

languages.set('en-EN',
  {
    i18n: {
      disclaimer: 'Please note: translations are provided by the community, and we cannot guarantee their correctness, completeness, or quality',
      cta: 'Do you speak fluent English and want to help us translate? Check out {url}'
    },
    prereqs: {
      errors: {
        masterUser: 'This command is only for the bot owner',
        serverOwner: 'You must be the server owner to run this command'
      }
    },
    commands: {
      common: {
        failedToRun: 'Yikes! This command failed, please give my owner this error code: `{uuid}`',
        softFail: 'Something went wrong, try again later',
        attachmentNeeded: 'Please upload an image while using this command',
        nsfwDisabled: 'This channel needs to be marked as NSFW before this command can be used',
        cooldown: 'This command is on cooldown, try again later',
        dmDisabled: 'This command cannot be used in DMs',
        permsMissingOwn: "I'm missing the following permissions: `{perms}`",
        permsMissingUser: "You're missing the following permissions: `{perms}`",
        working: 'Working on it...'
      },
      dice: {
        resultMany: 'You rolled **{result}**\n```{explaination}```',
        resultSingle: 'You rolled **{result}**',
        resultTooLarge: '[result too large to show explaination]',
        badSyntax: 'Please specify how many dice you want to roll like this: `4d6`, `2d12`'
      },
      booru: {
        noResults: 'No results found for `{query}`',
        badFormatting: 'Your formatting appears to be wrong',
        siteNotSupported: "I don't have support for {site}, currently I support {supported}"
      },
      info: {
        guilds: 'Guilds on this shard',
        uptime: 'Uptime',
        shard: 'Current shard',
        version: 'Version',
        owner: 'Owner',
        node: 'Node.js version',
        ram: 'Memory usage',
        os: 'Operating system',
        cpu: 'CPU usage',
        poweredBy: 'Powered by WildBeast'
      },
      invite: {
        done: 'Use the following link to invite me: {invite}',
        private: 'This bot is marked as private, please ask {owner} to invite me to your server'
      },
      leetspeak: {
        errors: {
          suffixMissing: 'You need to type something to encode your message into l337sp3@K'
        }
      },
      tag: {
        errors: {
          notFound: 'No such tag',
          conflict: 'A tag with that name already exists',
          illegal: "You can't name your tag that",
          notYours: "You don't own that tag, so you can't edit it"
        },
        owner: 'The owner of that tag is {user}',
        created: 'Your tag was created',
        deleted: 'Your tag was deleted',
        edited: 'Your tag was edited'
      },
      twitch: {
        errors: {
          noChannel: 'No channel specified',
          invalidChannel: "{channel} isn't a valid channel"
        },
        offline: "{channel} isn't streaming currently",
        online: '{channel} is currently live at <https://twitch.tv/{channel}>',
        game: 'Game',
        viewers: 'Viewers',
        views: 'Total Views'
      },
      kick: {
        noMentions: "Please provide IDs or mention users you'd like to kick",
        noResults: "Couldn't find those users in the server",
        done: 'Kicked {num} members',
        failed: 'Failed to kick {num} members'
      },
      ban: {
        noMentions: "Please provide IDs or mention users you'd like to ban",
        noResults: "Couldn't find those users in the server",
        done: 'Banned {num} members',
        failed: 'Failed to ban {num} members'
      },
      softban: {
        noMentions: "Please provide IDs or mention users you'd like to softban",
        noResults: "Couldn't find those users in the server",
        done: 'Softbanned {num} members',
        failed: 'Failed to softban {num} members'
      },
      purge: {
        notANumber: 'Your last argument must be a number',
        tooManyOrFew: "You're trying to remove too {num, select, few {few} many {many}} messages",
        noResults: 'I was not able to find any messages for purging that are under two weeks old'
      },
      urbandictionary: {
        errors: {
          noTerm: 'Please enter a search term',
          notFound: "This word is so screwed up, even Urban Dictionary doesn't know it"
        },
        example: 'Example',
        noExample: '[no example provided]'
      },
      xkcd: {
        errors: {
          limit: 'There are only {num} xkcd comics'
        }
      },
      help: {
        header: 'See <https://wildbeast.guide/commands> for a full list of commands',
        title: 'Help for command {cmd}',
        footer: '{botname} - Powered by WildBeast',
        errors: {
          notFound: 'No such command'
        }
      },
      '8ball': {
        prefix: 'The magic 8 ball says: `{response}`',
        choices: [
          'Signs point to yes',
          'Yes',
          'Reply hazy, try again',
          'Without a doubt',
          'My sources say no',
          'As I see it, yes',
          'You may rely on it',
          'Concentrate and ask again',
          'Outlook not so good',
          'It is decidedly so',
          'Better not tell you now',
          'Very doubtful',
          'Yes - definitely',
          'It is certain',
          'Cannot predict now',
          'Most likely',
          'Ask again later',
          'My reply is no',
          'Outlook good',
          "Don't count on it",
          'Who cares?',
          'Never, ever, ever',
          'Possibly',
          'There is a small chance'
        ]
      }
    }
  }
)
