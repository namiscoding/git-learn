window.LESSONS = window.LESSONS || {};
window.LESSONS['01'] = {
  title: 'What Git is and why',
  slides: [
    {
      type: 'story',
      title: 'Which one is the real one?',
      body: [
        'You write an essay. Before a big change you save a copy, just in case. Then another. Soon you have this.',
        'Which file is the latest? What changed between them? Which one did you send? Nobody can tell without opening each one.',
        'Git exists to end this.'
      ],
      visualHtml:
        '<ul class="file-pile" aria-label="Five copies of the same essay with confusing names">' +
        '<li class="reveal">essay.docx</li>' +
        '<li class="reveal">essay_final.docx</li>' +
        '<li class="reveal">essay_final_v2.docx</li>' +
        '<li class="reveal">essay_final_v2_REAL.docx</li>' +
        '<li class="reveal">essay_final_v2_REAL_use-this-one.docx</li>' +
        '<li class="reveal pile-q" aria-hidden="true">?</li>' +
        '</ul>'
    },
    {
      type: 'concept',
      title: 'Git keeps one file and remembers every version',
      body: [
        'With Git there is one <code>essay.txt</code>. Each time you reach a good point, you tell Git to <strong>save a version</strong>. Git stores them in order, so you can look back or return to any of them.',
        'Those saved versions are called <strong>commits</strong>. Watch two of them being made. You do not need to understand the commands yet; lessons 2 and 3 take them apart one at a time.'
      ],
      setup: ['git init'],
      steps: [
        { cmd: 'echo "Introduction" > essay.txt', caption: 'You write the first part of the essay. It sits in your working folder, and Git has not saved anything yet.' },
        { cmd: 'git add essay.txt', caption: 'You pick the file to include in the next saved version.' },
        { cmd: 'git commit -m "Write introduction"', caption: 'Version 1 is saved. The dot is one commit, a snapshot you can return to.' },
        { cmd: 'echo "Chapter 1" >> essay.txt', caption: 'You keep writing. The file changes, but version 1 is still safe in the repository.' },
        { cmd: 'git commit -am "Add chapter 1"', caption: 'Version 2 is saved on top of version 1. Same file, a growing history, and no essay_final_v2 anywhere.' }
      ]
    },
    {
      type: 'story',
      title: 'What a history gives you',
      body: [
        'Once every version is saved in order, a lot becomes possible.',
        'You will meet each of these in later lessons. For now, just notice that they all come from the same idea: <strong>a saved history</strong>.'
      ],
      visualHtml:
        '<div class="benefit-grid">' +
        '<div class="benefit reveal"><h3>Go back</h3><p>Return to any saved version if you break something.</p></div>' +
        '<div class="benefit reveal"><h3>See changes</h3><p>Find out what changed, and when.</p></div>' +
        '<div class="benefit reveal"><h3>Try ideas safely</h3><p>Work on a copy of the history (a branch) without risking the main line.</p></div>' +
        '<div class="benefit reveal"><h3>Work together</h3><p>Combine several people\'s changes into one project.</p></div>' +
        '</div>'
    },
    {
      type: 'story',
      title: 'Git is not GitHub',
      body: [
        'Beginners often mix these up, and it causes confusion for a long time.',
        '<strong>Git</strong> is a tool that runs on your own computer. It keeps your history. It works with no internet.',
        '<strong>GitHub</strong> is a website that stores a copy of your Git history online, so you can back it up, share it, and work with other people.',
        'You can use Git without GitHub. You cannot use GitHub without Git.'
      ],
      visualHtml:
        '<div class="two-boxes">' +
        '<div class="box box-local reveal"><h3>Git</h3><p class="where">on your computer</p><p>Saves versions of your files.</p><p>Needs no internet.</p></div>' +
        '<div class="box-link reveal" aria-hidden="true"><span>copies of the history travel between them</span></div>' +
        '<div class="box box-remote reveal"><h3>GitHub</h3><p class="where">a website</p><p>Keeps a copy online.</p><p>For sharing and teamwork.</p></div>' +
        '</div>'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        'Copying files as <code>final_v2_REAL</code> does not scale. Nobody knows which one is the latest.',
        'Git keeps <strong>one set of files</strong> and a <strong>saved history</strong> of versions, called commits.',
        'A history lets you go back, see what changed, try ideas safely, and work with others.',
        '<strong>Git</strong> is the tool on your computer. <strong>GitHub</strong> is a website that hosts copies of your history.',
        'Next lesson: the three places Git keeps your work.'
      ]
    }
  ]
};
