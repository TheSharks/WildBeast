import { defineRouteMiddleware } from '@astrojs/starlight/route-data'

const CROWDIN_PROJECT = 'https://crowdin.com/project/wildbeast'

// Translations live on Crowdin, not in git, so "Edit page" on a translated
// page has no file to open. Send translators to the project instead.
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  if (route.locale && route.editUrl) {
    route.editUrl = new URL(CROWDIN_PROJECT)
  }
})
