const KEY = 'todo_tasks_v1';
let seq = 0;

// Testitehtävän tehdas: jokaiselle uniikki id ja oletuskentät
const makeTask = (over = {}) => {
  seq += 1;
  return {
    id: `t_filter${seq}`,
    topic: `Tehtävä ${seq}`,
    priority: 'medium',
    status: 'todo',
    description: '',
    completed: false,
    createdAt: seq,
    updatedAt: seq,
    ...over,
  };
};

// Tarkistaa listassa näkyvien tehtävien aiheet järjestyksessä
const expectTopics = (expected) =>
  cy.get('#task-list .title').should(($t) => {
    expect([...$t].map((e) => e.textContent.trim())).to.deep.equal(expected);
  });

// Tarkistaa, mikä suodatinnappi on valittuna ('all' | 'low' | 'medium' | 'high')
const expectActiveFilter = (active) => {
  ['all', 'low', 'medium', 'high'].forEach((key) => {
    cy.get(`#filter-${key}`).should(
      'have.attr',
      'aria-pressed',
      String(key === active),
    );
  });
};

// Siemendata: 2 high (toinen valmis), 1 medium, 2 low
const seedTasks = () => [
  makeTask({ topic: 'High A', priority: 'high', createdAt: 10 }),
  makeTask({
    topic: 'High B (valmis)',
    priority: 'high',
    createdAt: 20,
    completed: true,
    status: 'done',
  }),
  makeTask({ topic: 'Medium A', priority: 'medium', createdAt: 30 }),
  makeTask({ topic: 'Low A', priority: 'low', createdAt: 40 }),
  makeTask({ topic: 'Low B', priority: 'low', createdAt: 50 }),
];

// Kaikki siemendatan tehtävät oletusjärjestyksessä
const ALL_TOPICS = [
  'High A',
  'Medium A',
  'Low B',
  'Low A',
  'High B (valmis)',
];

describe('Prioriteettisuodatus', () => {
  beforeEach(() => {
    cy.visitWithTasks(seedTasks());
  });

  it('näyttää oletuksena kaikki tehtävät ja Show all on valittuna', () => {
    expectTopics(ALL_TOPICS);
    expectActiveFilter('all');
    cy.get('#filter-empty-state').should('not.be.visible');
  });

  [
    ['high', ['High A', 'High B (valmis)']],
    ['medium', ['Medium A']],
    ['low', ['Low B', 'Low A']],
  ].forEach(([priority, expected]) => {
    it(`${priority}-napin klikkaus näyttää vain ${priority}-prioriteetin tehtävät`, () => {
      cy.get(`#filter-${priority}`).click();
      cy.get('li.task').should('have.length', expected.length);
      expectTopics(expected);
      expectActiveFilter(priority);
      cy.get('#task-list .badge[class*="prio-"]').each(($badge) => {
        expect($badge).to.have.class(`prio-${priority}`);
      });
    });
  });

  it('suodatettu lista säilyttää järjestyksen ja näyttää myös valmiit tehtävät', () => {
    cy.get('#filter-high').click();
    // Keskeneräinen ensin, valmis viimeisenä
    expectTopics(['High A', 'High B (valmis)']);
    cy.taskRow('High B (valmis)').should('have.class', 'done');
  });

  it('Show all poistaa suodatuksen ja palauttaa kaikki tehtävät', () => {
    cy.get('#filter-high').click();
    cy.get('li.task').should('have.length', 2);

    cy.get('#filter-all').click();
    cy.get('li.task').should('have.length', 5);
    expectTopics(ALL_TOPICS);
    expectActiveFilter('all');
  });

  it('Show all ilman aktiivista suodatusta ei muuta mitään', () => {
    cy.get('#filter-all').click();
    expectTopics(ALL_TOPICS);
    expectActiveFilter('all');
  });

  it('aktiivisen prioriteettinapin uusi klikkaus poistaa suodatuksen', () => {
    cy.get('#filter-medium').click();
    expectTopics(['Medium A']);

    cy.get('#filter-medium').click();
    expectTopics(ALL_TOPICS);
    expectActiveFilter('all');
  });

  it('suodatuksen vaihto prioriteetista toiseen näyttää vain uuden prioriteetin tehtävät', () => {
    cy.get('#filter-high').click();
    expectTopics(['High A', 'High B (valmis)']);

    cy.get('#filter-low').click();
    expectTopics(['Low B', 'Low A']);
    expectActiveFilter('low');
  });

  it('suodatus ei muuta tallennettua dataa eikä tallenna mitään lisää selaimeen', () => {
    cy.storedTasks().then((before) => {
      cy.get('#filter-high').click();
      cy.get('#filter-low').click();
      cy.get('#filter-all').click();
      cy.storedTasks().should('deep.equal', before);
      cy.window().then((win) => {
        expect(Object.keys(win.localStorage)).to.deep.equal([KEY]);
        expect(Object.keys(win.sessionStorage)).to.have.length(0);
      });
    });
  });

  it('suodatus ei säily sivun uudelleenlatauksen yli', () => {
    cy.get('#filter-high').click();
    cy.get('li.task').should('have.length', 2);

    cy.reload();
    expectTopics(ALL_TOPICS);
    expectActiveFilter('all');
  });
});

describe('Prioriteettisuodatus: tyhjät tilat', () => {
  it('näyttää viestin, kun valitulla prioriteetilla ei ole tehtäviä, ja Show all piilottaa sen', () => {
    cy.visitWithTasks([makeTask({ topic: 'Vain high', priority: 'high' })]);

    cy.get('#filter-low').click();
    cy.get('li.task').should('have.length', 0);
    cy.get('#filter-empty-state')
      .should('be.visible')
      .and('contain', 'No tasks with Low priority');
    // "Ei tehtäviä lainkaan" -viesti on eri asia eikä saa näkyä
    cy.get('#empty-state').should('not.be.visible');

    cy.get('#filter-all').click();
    cy.get('#filter-empty-state').should('not.be.visible');
    cy.get('li.task').should('have.length', 1);
  });

  it('ei näytä suodatuksen tyhjää viestiä, kun tehtäviä ei ole lainkaan', () => {
    cy.visit('/');
    cy.get('#filter-high').click();
    cy.get('li.task').should('have.length', 0);
    cy.get('#empty-state').should('be.visible');
    cy.get('#filter-empty-state').should('not.be.visible');
  });
});

describe('Prioriteettisuodatus yhdessä muiden toimintojen kanssa', () => {
  beforeEach(() => {
    cy.visitWithTasks(seedTasks());
  });

  it('suodatinta vastaava uusi tehtävä näkyy heti, muu vasta Show all:n jälkeen', () => {
    cy.get('#filter-low').click();

    cy.addTask({ topic: 'Uusi low', priority: 'low' });
    // Uusin ensin samalla prioriteetilla
    expectTopics(['Uusi low', 'Low B', 'Low A']);

    cy.addTask({ topic: 'Uusi high', priority: 'high' });
    cy.get('#task-list').should('not.contain', 'Uusi high');
    expectActiveFilter('low');

    cy.get('#filter-all').click();
    cy.get('#task-list').should('contain', 'Uusi high');
    cy.get('li.task').should('have.length', 7);
  });

  it('Complete ja Delete toimivat suodatetussa listassa eikä suodatus nollaudu', () => {
    cy.on('window:confirm', () => true);
    cy.get('#filter-high').click();

    cy.taskRow('High A').find('[data-action=complete]').click();
    cy.taskRow('High A').should('have.class', 'done');
    cy.get('li.task').should('have.length', 2);
    expectActiveFilter('high');

    cy.taskRow('High A').find('[data-action=delete]').click();
    expectTopics(['High B (valmis)']);
    expectActiveFilter('high');

    cy.get('#filter-all').click();
    expectTopics(['Medium A', 'Low B', 'Low A', 'High B (valmis)']);
  });

  it('muokkaus toiseen prioriteettiin siirtää tehtävän pois suodatetusta listasta', () => {
    cy.get('#filter-low').click();

    cy.taskRow('Low A').find('[data-action=edit]').click();
    cy.get('#priority').select('high');
    cy.get('#save-btn').click();

    expectTopics(['Low B']);
    cy.get('#form-title').should('have.text', 'Create Task');
    expectActiveFilter('low');

    cy.get('#filter-all').click();
    cy.taskRow('Low A').find('.badge.prio-high').should('exist');
  });
});
