export type TutorialLesson = {
  title: string;
  intro: string;
  steps: readonly string[];
  check?: string;
};

export function filterTutorialLessons<T extends TutorialLesson>(
  lessons: readonly T[],
  query: string,
) {
  const term = query.trim().toLocaleLowerCase();
  return lessons.flatMap((lesson, index) => {
    const text = `${lesson.title} ${lesson.intro} ${lesson.steps.join(' ')} ${lesson.check || ''}`;
    return text.toLocaleLowerCase().includes(term) ? [{lesson, index}] : [];
  });
}
