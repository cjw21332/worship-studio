import {useState} from 'react';
import {Modal} from './ui';
import {useDeskTranslate} from './i18n';
import {filterTutorialLessons, type TutorialLesson} from './tutorial-guide-model';
import './tutorial-guide.css';

type Lesson = TutorialLesson;

const lessons: Lesson[] = [
  {
    title: 'Start here',
    intro:
      'Practice with a rehearsal display before a service. Prepare mode is for editing; Present mode protects the service from accidental edits.',
    steps: [
      'Choose View → Prepare mode. In Simple mode, only the most common controls are shown; choose View → Full mode to see advanced tools.',
      'Gather songs, Bible passages and media in the Library, then add them to the service list.',
      'Select an item and a slide to preview it. Preview is separate from the live output.',
      'Open Output → Outputs and displays, choose a rehearsal or audience display and arm it. Arming starts black.',
      'Check the preview, then choose Go Live. Practice navigating slides and using blackout before the service.',
    ],
    check: 'Run Service → Pre-flight check and resolve any reported issues before presenting.',
  },
  {
    title: 'Songs',
    intro: 'Create or import songs, then add them to your service.',
    steps: [
      'Choose Library → New song, enter the title and lyrics, and fill in the available author and copyright details.',
      'Review the slide breaks and lines per slide in the editor, then save or add the song to the service.',
      'To import, choose File → Import → Songs, select a supported file and review the import before committing it.',
      'Use the Songs library search to find a song; select its add control or drag it into the service.',
      'Open Library → Database manager to edit or remove songs and optimize identical copies.',
    ],
    check: 'Preview every generated slide for missing words, awkward breaks and correct spelling.',
  },
  {
    title: 'Bible passages',
    intro: 'Find a passage and add it to a service or use the quick Bible panel.',
    steps: [
      'Open the Bible library or choose Library → Add Bible passage.',
      'Select a translation, enter a reference or search text, and review the results.',
      'Select the passage and add it to the service; preview the slides and reference.',
      'In Full mode, use File → Import → Bible translation to add a translation, or Library → Translation settings to manage translations.',
    ],
    check: 'Confirm the translation, reference and verse text before sending it live.',
  },
  {
    title: 'Plan a service',
    intro: 'Arrange the items in the order they will be presented.',
    steps: [
      'Choose File → New service, then add songs, Bible passages, notes, slides or media from the Library.',
      'Drag service items to reorder them, or use their move controls. Select an item to see its slides.',
      'Use item options to adjust its details and available appearance settings.',
      'Save with File → Save. In Full mode, Service → Service tools provides templates and other planning tools.',
      'Use Service → Undo or Redo to correct supported service edits.',
    ],
    check: 'Run the pre-flight check, review each item, and save the finished service.',
  },
  {
    title: 'Present and outputs',
    intro: 'Use preview to prepare the next slide while the audience sees the current output.',
    steps: [
      'Connect your display and open Output → Outputs and displays. Select the intended display and arm it; the output starts black.',
      'Select a service item and slide. Check the preview, then choose Go Live to send it to the output.',
      'Use the slide controls to move through the service. View → Present mode reduces accidental editing.',
      'Use Freeze to hold the current display while preparing a change. Unfreeze when ready to show the prepared output.',
      'Use blackout when the audience screen should be black. Configure stage display and output locking from the Output menu.',
    ],
    check: 'Test the actual connected displays and verify what the audience can see. Disarm outputs when finished.',
  },
  {
    title: 'Media and text',
    intro: 'Bring images, video, presentations and text into your service.',
    steps: [
      'Use File → Import to select images, video or, in Full mode, PowerPoint. Wait for the import to finish.',
      'Find imported content in the appropriate Library tab and add it to the service.',
      'Choose Library → New note or New slide set to create text content. Enter a title and text, then add it.',
      'Open an item\'s options to adjust available background and appearance settings.',
    ],
    check: 'Preview and test media playback on the intended computer before the service. Packaging a service can include its media for sharing.',
  },
  {
    title: 'Themes and preferences',
    intro: 'Make the workspace readable and adjust the appearance of projected content.',
    steps: [
      'Choose Output → Themes to select or edit a presentation theme and apply it to the available scope.',
      'Use View → Theme and View → UI scale to change the operator workspace appearance.',
      'Choose View → Simple mode or Full mode to adjust how many controls are shown.',
      'Open Settings for available language, touch, accessibility and operator preferences.',
    ],
    check: 'Check contrast, font size and line breaks on the real display from the audience\'s viewing distance.',
  },
  {
    title: 'Sharing, recovery and help',
    intro: 'Save your work and keep a copy that can be restored or shared.',
    steps: [
      'Use File → Save regularly. Choose File → Package with media to prepare a service for sharing.',
      'Use File → Export for songs, usage CSV or a settings backup; choose a safe location for the exported file.',
      'Service → Restore recovery snapshot is available when a recovery snapshot exists. Review the restored service before presenting.',
      'Open Help → Keyboard shortcuts for the current shortcut list, Help → Diagnostics for troubleshooting, or Help → Welcome guide to return here.',
      'Hover over supported controls for contextual help. Read messages and confirmations before proceeding.',
    ],
    check: 'Test shared packages and backups on the destination computer before relying on them.',
  },
];

export function Tutorial({onClose}: {onClose: () => void}) {
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState('');
  const tr = useDeskTranslate();
  const matches = filterTutorialLessons(lessons, query);
  const selectedPosition = Math.max(0, matches.findIndex(match => match.index === index));
  const selected = matches[selectedPosition];
  const current = selected?.lesson;
  const navigate = (delta: number) => {
    const next = matches[selectedPosition + delta];
    if (next) setIndex(next.index);
  };

  return (
    <Modal
      title="Worship Studio walkthrough"
      onClose={onClose}
      wide
      className="tutorial-dialog"
    >
      <div className="tutorial-guide">
        <p className="tutorial-intro">
          {tr('Choose a topic, follow the steps, and practice with a rehearsal display. You can reopen this guide from Help → Welcome guide.')}
        </p>
        <div className="tutorial-layout">
          <nav className="tutorial-navigation" aria-label={tr('Walkthrough topics')}>
            <label htmlFor="tutorial-search">{tr('Find a topic')}</label>
            <input
              id="tutorial-search"
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={tr('Search the guide')}
            />
            <div className="tutorial-topics">
              {matches.map(({lesson, index: topicIndex}) => (
                <button
                  type="button"
                  key={lesson.title}
                  aria-current={selected?.index === topicIndex ? 'step' : undefined}
                  onClick={() => setIndex(topicIndex)}
                >
                  {lesson.title}
                </button>
              ))}
              {!matches.length && (
                <div className="tutorial-empty">
                  <p>{tr('No topics found. Try another search.')}</p>
                  <button type="button" onClick={() => setQuery('')}>{tr('Clear search')}</button>
                </div>
              )}
            </div>
          </nav>
          <section className="tutorial-content" aria-live="polite" aria-atomic="true">
            {current ? (
              <>
                <div className="tutorial-progress" aria-label={`${tr('Topic')} ${selectedPosition + 1} ${tr('of')} ${matches.length}`}>
                  <span>{selectedPosition + 1} / {matches.length}</span>
                  <div
                    className="tutorial-progress-track"
                    role="progressbar"
                    aria-label={tr('Walkthrough progress')}
                    aria-valuemin={1}
                    aria-valuemax={matches.length}
                    aria-valuenow={selectedPosition + 1}
                  >
                    <span style={{width: `${((selectedPosition + 1) / matches.length) * 100}%`}} />
                  </div>
                </div>
                <div className="tutorial-lesson">
                  <h3>{current.title}</h3>
                  <p className="tutorial-lesson-intro">{current.intro}</p>
                  <ol>
                    {current.steps.map(step => <li key={step}>{step}</li>)}
                  </ol>
                  {current.check && (
                    <aside className="tutorial-check">
                      <strong>{tr('Before moving on')}</strong>
                      <p>{current.check}</p>
                    </aside>
                  )}
                </div>
                <footer className="tutorial-actions">
                  <button
                    type="button"
                    disabled={selectedPosition === 0}
                    onClick={() => navigate(-1)}
                  >
                    {tr('Previous')}
                  </button>
                  {selectedPosition < matches.length - 1 ? (
                    <button type="button" className="primary" onClick={() => navigate(1)}>
                      {tr('Next topic')}
                    </button>
                  ) : (
                    <button type="button" className="primary" onClick={onClose}>
                      {tr('Finish')}
                    </button>
                  )}
                </footer>
              </>
            ) : (
              <p className="tutorial-no-selection" role="status">
                {tr('No topics found. Try another search.')}
              </p>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}