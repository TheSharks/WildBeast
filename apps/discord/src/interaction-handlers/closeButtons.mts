import { ApplyOptions } from '@sapphire/decorators'
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework'
import {
  type APIActionRowComponent,
  type APIComponentInContainer,
  type APIComponentInMessageActionRow,
  type APIMessageTopLevelComponent,
  type ButtonInteraction,
  ButtonStyle,
  ComponentType,
} from 'discord.js'

function keepOnlyLinkButtons(
  row: APIActionRowComponent<APIComponentInMessageActionRow>,
): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  const links = row.components.filter(
    (component) =>
      component.type === ComponentType.Button &&
      component.style === ButtonStyle.Link,
  )
  return links.length > 0 ? [{ ...row, components: links }] : []
}

/** ✖️ strips interactive buttons, keeping content and link buttons. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class CloseButtonHandler extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    return interaction.customId === 'close' ? this.some() : this.none()
  }

  public async run(interaction: ButtonInteraction) {
    const components = interaction.message.components
      .map((component) => component.toJSON())
      .flatMap((component): APIMessageTopLevelComponent[] => {
        if (component.type === ComponentType.ActionRow) {
          return keepOnlyLinkButtons(component)
        }
        if (component.type === ComponentType.Container) {
          return [
            {
              ...component,
              components: component.components.flatMap(
                (inner): APIComponentInContainer[] =>
                  inner.type === ComponentType.ActionRow
                    ? keepOnlyLinkButtons(inner)
                    : [inner],
              ),
            },
          ]
        }
        return [component]
      })

    return interaction.update({ components })
  }
}
