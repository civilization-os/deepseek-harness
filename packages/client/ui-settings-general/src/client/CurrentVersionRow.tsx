/** Installed release version in General Settings for Web and Desktop. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './CurrentVersionRow.module.css'

/**
 * Render the version embedded by the client build; partial builds without metadata omit the row.
 * @param props - runtime share and localized copy.
 * @returns the current release label and repository link, or nothing when build metadata is absent.
 */
export function CurrentVersionRow({ t }: PropsRuntime<'settings.general.item'> & PropsLocale<'settings'>) {
  const version = process.env.DSH_CLIENT_VERSION
  if (version === undefined) return null
  return (
    <div className={css.row}>
      <div className={css.versionLine}>
        <span>{t('general.currentVersion', { version })}</span>
        <span className={css.badge}>{t('general.buildLabel')}</span>
      </div>
      <div className={css.repoLine}>
        <a
          href="https://github.com/civilization-os/deepseek-harness"
          target="_blank"
          rel="noreferrer"
          className={css.link}
        >
          {t('general.aboutGithub')}
        </a>
      </div>
    </div>
  )
}
