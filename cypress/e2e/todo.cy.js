const KEY = 'todo_tasks_v1';
let seq = 0;

// Testitehtävän tehdas: jokaiselle uniikki id ja oletuskentät
const makeTask = (over = {}) => {
  seq += 1;
  return {
    id: `t_seed${seq}`,
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

// Tarkistaa rivien aiheiden järjestyksen (toistaa kunnes täsmää)
const expectOrder = (expected) =>
  cy.get('#task-list .title').should(($t) => {
    expect([...$t].map((e) => e.textContent.trim())).to.deep.equal(expected);
  });

describe('Luo tehtävä', () => {
  beforeEach(() => cy.visit('/'));

  it('näyttää tyhjän tilan ennen ensimmäistä tehtävää', () => {
    cy.get('#empty-state').should('be.visible');
    cy.get('li.task').should('have.length', 0);
    cy.get('#form-title').should('have.text', 'Create Task');
  });

  it('luo tehtävän vain pakollisella kentällä (aihe)', () => {
    cy.addTask({ topic: 'Minimi' });
    cy.get('li.task').should('have.length', 1);
    cy.taskRow('Minimi').find('.desc').should('have.text', '');
    cy.taskRow('Minimi').find('.badge').eq(0).should('contain', 'Medium');
    cy.taskRow('Minimi').find('.badge').eq(1).should('contain', 'To do');
    cy.get('#empty-state').should('not.be.visible');
  });

  it('luo tehtävän kaikilla kentillä', () => {
    cy.addTask({
      topic: 'Täysi',
      priority: 'high',
      status: 'in-progress',
      description: 'Kuvaus',
    });
    cy.taskRow('Täysi').find('.desc').should('have.text', 'Kuvaus');
    cy.taskRow('Täysi').find('.badge.prio-high').should('contain', 'High');
    cy.taskRow('Täysi').find('.badge').eq(1).should('contain', 'In progress');
  });

  it('luo tehtävän maksimisyötteellä (120 merkin aihe, 5000 merkin kuvaus)', () => {
    const description = 'y'.repeat(5000);
    cy.get('#topic').type('x'.repeat(120), { delay: 0 });
    cy.get('#description').invoke('val', description);
    cy.get('#save-btn').click();
    cy.storedTasks().then((tasks) => {
      expect(tasks).to.have.length(1);
      expect(tasks[0].topic).to.have.length(120);
      expect(tasks[0].description).to.have.length(5000);
    });
  });

  it('katkaisee aiheen 120 merkkiin (maxlength)', () => {
    cy.get('#topic').type('x'.repeat(130), { delay: 0 });
    cy.get('#topic').invoke('val').should('have.length', 120);
  });

  it('estää tyhjän aiheen (selaimen required-validointi)', () => {
    cy.get('#save-btn').click();
    cy.get('#topic').then(($i) =>
      expect($i[0].validity.valueMissing).to.eq(true),
    );
    cy.get('li.task').should('have.length', 0);
    cy.window().then((win) => expect(win.localStorage.getItem(KEY)).to.be.null);
  });

  it('hylkää pelkistä välilyönneistä koostuvan aiheen (JS trim)', () => {
    cy.get('#topic').type('   ');
    cy.get('#save-btn').click();
    cy.get('li.task').should('have.length', 0);
    cy.focused().should('have.id', 'topic');
    cy.window().then((win) => expect(win.localStorage.getItem(KEY)).to.be.null);
  });

  it('poistaa aiheen ja kuvauksen ympäriltä välilyönnit', () => {
    cy.addTask({ topic: '  Siisti  ', description: '  kuvaus  ' });
    cy.storedTasks().then(([t]) => {
      expect(t.topic).to.eq('Siisti');
      expect(t.description).to.eq('kuvaus');
    });
  });

  it('säilyttää ääkköset ja erikoismerkit sellaisenaan', () => {
    const topic = 'Äiti & isä: "työt" \'100%\' {x}';
    cy.addTask({ topic });
    cy.get('#task-list .title').should('have.text', topic);
  });

  it('tyhjentää lomakkeen ja palauttaa oletusarvot tallennuksen jälkeen', () => {
    cy.addTask({
      topic: 'Nollaus',
      priority: 'high',
      status: 'blocked',
      description: 'x',
    });
    cy.get('#topic').should('have.value', '');
    cy.get('#description').should('have.value', '');
    cy.get('#priority').should('have.value', 'medium');
    cy.get('#status').should('have.value', 'todo');
  });

  it('Reset-nappi tyhjentää lomakkeen', () => {
    cy.get('#topic').type('Kesken');
    cy.get('#priority').select('high');
    cy.get('#reset-btn').click();
    cy.get('#topic').should('have.value', '');
    cy.get('#priority').should('have.value', 'medium');
  });

  it('luo tehtävän tilalla Done valmiiksi merkittynä', () => {
    cy.addTask({ topic: 'Heti valmis', status: 'done' });
    cy.taskRow('Heti valmis').should('have.class', 'done');
    cy.taskRow('Heti valmis').contains('button', 'Undo');
  });
});

describe('Näytä ja listaa tehtävät', () => {
  it('järjestää: keskeneräiset ensin, prioriteetti, uusin ensin', () => {
    cy.visitWithTasks([
      makeTask({ topic: 'A low vanha', priority: 'low', createdAt: 1 }),
      makeTask({ topic: 'B high vanha', priority: 'high', createdAt: 2 }),
      makeTask({ topic: 'C high uusi', priority: 'high', createdAt: 3 }),
      makeTask({
        topic: 'D valmis high',
        priority: 'high',
        createdAt: 4,
        completed: true,
        status: 'done',
      }),
      makeTask({ topic: 'E medium', priority: 'medium', createdAt: 5 }),
    ]);
    expectOrder([
      'C high uusi',
      'B high vanha',
      'E medium',
      'A low vanha',
      'D valmis high',
    ]);
  });

  it('näyttää tehtävän kentät oikein', () => {
    cy.visitWithTasks([
      makeTask({
        topic: 'Raportti',
        description: 'Kirjoita loppuun',
        priority: 'high',
        status: 'in-progress',
      }),
    ]);
    cy.taskRow('Raportti').within(() => {
      cy.get('.desc').should('have.text', 'Kirjoita loppuun');
      cy.get('.badge.prio-high').should('contain', 'High');
      cy.get('.badge').eq(1).should('contain', 'In progress');
      cy.contains('button', 'Edit');
      cy.contains('button', 'Complete');
      cy.contains('button', 'Delete');
    });
  });

  it('näyttää tehtävän, jolla ei ole kuvausta, ilman "undefined"-tekstiä', () => {
    cy.visitWithTasks([
      makeTask({ topic: 'Ei kuvausta', description: undefined }),
    ]);
    cy.taskRow('Ei kuvausta').should('not.contain', 'undefined');
  });

  it('piilottaa tyhjän tilan, kun tehtäviä on', () => {
    cy.visitWithTasks([makeTask()]);
    cy.get('#empty-state').should('not.be.visible');
  });

  it('päivittää listan heti ilman sivun uudelleenlatausta', () => {
    cy.visit('/');
    cy.window().then((win) => {
      win.__eiLatausta = true;
    });
    cy.addTask({ topic: 'Yksi' });
    cy.addTask({ topic: 'Kaksi' });
    cy.get('li.task').should('have.length', 2);
    cy.taskRow('Yksi').find('[data-action=complete]').click();
    cy.taskRow('Yksi').should('have.class', 'done');
    cy.window().its('__eiLatausta').should('eq', true);
  });

  it('asettaa uuden tehtävän oikeaan kohtaan heti luonnin jälkeen', () => {
    cy.visitWithTasks([makeTask({ topic: 'Vanha low', priority: 'low' })]);
    cy.addTask({ topic: 'Uusi high', priority: 'high' });
    expectOrder(['Uusi high', 'Vanha low']);
  });

  it('siirtää valmiiksi merkityn tehtävän listan loppuun heti', () => {
    cy.visitWithTasks([
      makeTask({ topic: 'Ylin', priority: 'high', createdAt: 2 }),
      makeTask({ topic: 'Alin', priority: 'low', createdAt: 1 }),
    ]);
    cy.taskRow('Ylin').find('[data-action=complete]').click();
    expectOrder(['Alin', 'Ylin']);
  });
});

describe('Päivitä tehtävä', () => {
  beforeEach(() => {
    cy.visitWithTasks([
      makeTask({
        topic: 'Muokattava',
        description: 'Vanha kuvaus',
        priority: 'low',
        status: 'todo',
      }),
    ]);
  });

  it('Edit täyttää lomakkeen ja vaihtaa lomakkeen tilan', () => {
    cy.taskRow('Muokattava').find('[data-action=edit]').click();
    cy.get('#form-title').should('have.text', 'Edit Task');
    cy.get('#save-btn').should('have.text', 'Update Task');
    cy.get('#topic').should('have.value', 'Muokattava');
    cy.get('#description').should('have.value', 'Vanha kuvaus');
    cy.get('#priority').should('have.value', 'low');
    cy.get('#status').should('have.value', 'todo');
  });

  it('muokkaa kenttiä ilman uutta riviä ja palauttaa lomakkeen luontitilaan', () => {
    cy.taskRow('Muokattava').find('[data-action=edit]').click();
    cy.get('#topic').clear().type('Muokattu');
    cy.get('#description').clear().type('Uusi kuvaus');
    cy.get('#priority').select('high');
    cy.get('#status').select('in-progress');
    cy.get('#save-btn').click();

    cy.get('li.task').should('have.length', 1);
    cy.taskRow('Muokattu').within(() => {
      cy.get('.desc').should('have.text', 'Uusi kuvaus');
      cy.get('.badge.prio-high').should('exist');
      cy.get('.badge').eq(1).should('contain', 'In progress');
    });
    cy.get('#form-title').should('have.text', 'Create Task');
    cy.get('#save-btn').should('have.text', 'Save Task');
  });

  it('päivitys säilyttää id:n ja createdAt:n mutta muuttaa updatedAt:n', () => {
    cy.storedTasks().then(([before]) => {
      cy.taskRow('Muokattava').find('[data-action=edit]').click();
      cy.get('#topic').clear().type('Muokattu');
      cy.get('#save-btn').click();
      cy.storedTasks().then(([after]) => {
        expect(after.id).to.eq(before.id);
        expect(after.createdAt).to.eq(before.createdAt);
        expect(after.updatedAt).to.be.greaterThan(before.updatedAt);
      });
    });
  });

  it('Reset kesken muokkauksen palauttaa luontitilaan eikä muuta tehtävää', () => {
    cy.taskRow('Muokattava').find('[data-action=edit]').click();
    cy.get('#topic').clear().type('Ei tallenneta');
    cy.get('#reset-btn').click();
    cy.get('#form-title').should('have.text', 'Create Task');
    cy.get('#save-btn').should('have.text', 'Save Task');
    cy.taskRow('Muokattava').should('exist');
  });

  it('Complete merkitsee valmiiksi ja Undo palauttaa tilaan To do', () => {
    cy.taskRow('Muokattava').find('[data-action=complete]').click();
    cy.taskRow('Muokattava').should('have.class', 'done');
    cy.taskRow('Muokattava').find('.badge').eq(1).should('contain', 'Done');
    cy.taskRow('Muokattava').contains('button', 'Undo').click();
    cy.taskRow('Muokattava').should('not.have.class', 'done');
    cy.taskRow('Muokattava').find('.badge').eq(1).should('contain', 'To do');
    cy.taskRow('Muokattava').contains('button', 'Complete');
  });

  it('tilan vaihto Done:ksi lomakkeella merkitsee tehtävän valmiiksi', () => {
    cy.taskRow('Muokattava').find('[data-action=edit]').click();
    cy.get('#status').select('done');
    cy.get('#save-btn').click();
    cy.taskRow('Muokattava').should('have.class', 'done');
  });

  it('NYKYTILA: Complete + Undo ei palauta alkuperäistä Blocked-tilaa', () => {
    cy.visitWithTasks([makeTask({ topic: 'Jumissa', status: 'blocked' })]);
    cy.taskRow('Jumissa').find('[data-action=complete]').click();
    cy.taskRow('Jumissa').contains('button', 'Undo').click();
    cy.taskRow('Jumissa').find('.badge').eq(1).should('contain', 'To do');
  });

  it('NYKYTILA: valmiin tehtävän tilan vaihto lomakkeella To do:ksi jättää sen valmiiksi', () => {
    cy.visitWithTasks([
      makeTask({ topic: 'Valmis', status: 'done', completed: true }),
    ]);
    cy.taskRow('Valmis').find('[data-action=edit]').click();
    cy.get('#status').select('todo');
    cy.get('#save-btn').click();
    cy.taskRow('Valmis').find('.badge').eq(1).should('contain', 'To do');
    cy.taskRow('Valmis').should('have.class', 'done');
    cy.taskRow('Valmis').contains('button', 'Undo');
  });
});

describe('Poista tehtävä', () => {
  beforeEach(() => {
    cy.visitWithTasks([
      makeTask({ topic: 'Poistettava', createdAt: 3 }),
      makeTask({ topic: 'Säilyvä', createdAt: 2 }),
    ]);
  });

  it('näyttää vahvistusdialogin oikealla tekstillä', () => {
    const confirmStub = cy.stub().returns(false);
    cy.on('window:confirm', confirmStub);
    cy.taskRow('Poistettava')
      .find('[data-action=delete]')
      .click()
      .then(() => {
        expect(confirmStub).to.have.been.calledOnce;
        expect(confirmStub.firstCall.args[0]).to.eq('Delete this task?');
      });
  });

  it('peruutus säilyttää tehtävän listassa ja tallennuksessa', () => {
    cy.on('window:confirm', () => false);
    cy.taskRow('Poistettava').find('[data-action=delete]').click();
    cy.get('li.task').should('have.length', 2);
    cy.storedTasks().should('have.length', 2);
  });

  it('vahvistus poistaa vain valitun tehtävän', () => {
    cy.on('window:confirm', () => true);
    cy.taskRow('Poistettava').find('[data-action=delete]').click();
    cy.get('li.task').should('have.length', 1);
    cy.get('#task-list')
      .should('not.contain', 'Poistettava')
      .and('contain', 'Säilyvä');
  });

  it('on hard delete: tehtävä poistuu tallennuksesta eikä palaa uudelleenlatauksessa', () => {
    cy.on('window:confirm', () => true);
    cy.taskRow('Poistettava').find('[data-action=delete]').click();
    cy.storedTasks().then((tasks) => {
      expect(tasks.map((t) => t.topic)).to.deep.equal(['Säilyvä']);
    });
    cy.reload();
    cy.get('#task-list').should('not.contain', 'Poistettava');
  });

  it('viimeisen tehtävän poisto näyttää tyhjän tilan', () => {
    cy.on('window:confirm', () => true);
    cy.taskRow('Poistettava').find('[data-action=delete]').click();
    cy.taskRow('Säilyvä').find('[data-action=delete]').click();
    cy.get('li.task').should('have.length', 0);
    cy.get('#empty-state').should('be.visible');
  });
});

describe('Datan säilyvyys ja offline-toiminta', () => {
  it('säilyttää luodut ja muokatut tehtävät uudelleenlatauksessa', () => {
    cy.visit('/');
    cy.addTask({ topic: 'Pysyvä', priority: 'high' });
    cy.taskRow('Pysyvä').find('[data-action=complete]').click();
    cy.reload();
    cy.taskRow('Pysyvä').should('have.class', 'done');
    cy.taskRow('Pysyvä').find('.badge.prio-high').should('exist');
  });

  it('tallentaa tehtävän odotetussa muodossa', () => {
    cy.visit('/');
    cy.addTask({
      topic: 'Muoto',
      description: 'd',
      priority: 'low',
      status: 'blocked',
    });
    cy.storedTasks().then(([t]) => {
      expect(t.id).to.match(/^t_[a-z0-9]+$/);
      expect(t).to.include({
        topic: 'Muoto',
        description: 'd',
        priority: 'low',
        status: 'blocked',
        completed: false,
      });
      expect(t.createdAt).to.be.a('number');
      expect(t.updatedAt).to.eq(t.createdAt);
    });
  });

  it('toipuu rikkinäisestä JSON-datasta tyhjällä listalla', () => {
    cy.visitWithRawStorage('{rikki');
    cy.get('#empty-state').should('be.visible');
    cy.addTask({ topic: 'Uusi alku' });
    cy.storedTasks().should('have.length', 1);
  });

  it('toipuu väärän muotoisesta datasta (ei taulukko)', () => {
    cy.visitWithRawStorage(JSON.stringify({ a: 1 }));
    cy.get('#empty-state').should('be.visible');
  });

  it('toimii ilman verkkoyhteyttä: sovellus ei tee verkkopyyntöjä', () => {
    cy.visit('/');
    cy.intercept('**', cy.spy().as('verkkopyynnot'));
    cy.addTask({ topic: 'Offline' });
    cy.taskRow('Offline').should('exist');
    cy.storedTasks().should('have.length', 1);
    cy.get('@verkkopyynnot').should('not.have.been.called');
  });
});

describe('Virheenkäsittely', () => {
  it('NYKYTILA: täysi tallennustila ei näy käyttäjälle ilmoituksena', () => {
    cy.on('uncaught:exception', (err) => {
      expect(err.message).to.include('QuotaExceededError');
      return false;
    });
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.Storage.prototype, 'setItem').throws(
          new Error('QuotaExceededError'),
        );
      },
    });
    cy.addTask({ topic: 'Ei mahdu' });
    cy.get('li.task').should('have.length', 0);
    cy.get('#empty-state').should('be.visible');
    cy.get('#topic').should('have.value', 'Ei mahdu');
  });
});

describe('Suorituskyvyn perusasiat', () => {
  const many = () =>
    Array.from({ length: 500 }, (_, i) =>
      makeTask({
        topic: `Massa ${i}`,
        priority: ['low', 'medium', 'high'][i % 3],
        createdAt: i,
      }),
    );

  it('500 tehtävän lista latautuu ja renderöityy alle 2 sekunnissa', () => {
    cy.visitWithTasks(many());
    cy.get('li.task').should('have.length', 500);
    cy.window().then((win) => {
      const [nav] = win.performance.getEntriesByType('navigation');
      expect(nav.domContentLoadedEventEnd - nav.startTime).to.be.lessThan(2000);
    });
  });

  it('tehtävän luonti 500 tehtävän listaan kestää alle 500 ms', () => {
    cy.visitWithTasks(many());
    cy.get('li.task').should('have.length', 500);
    cy.window().then((win) => {
      win.document.getElementById('topic').value = 'Mitattava';
      const t0 = win.performance.now();
      win.document.getElementById('task-form').requestSubmit();
      expect(win.performance.now() - t0).to.be.lessThan(500);
    });
    cy.get('li.task').should('have.length', 501);
  });

  it('tehtävän avaaminen muokkaukseen kestää alle 200 ms', () => {
    cy.visitWithTasks(many());
    cy.get('li.task [data-action=edit]')
      .first()
      .then(($btn) => {
        const t0 = performance.now();
        $btn[0].click();
        expect(performance.now() - t0).to.be.lessThan(200);
      });
    cy.get('#form-title').should('have.text', 'Edit Task');
  });

  it('NYKYTILA: kaikki tehtävät renderöidään kerralla (ei sivutusta tai virtuaalista vieritystä)', () => {
    cy.visitWithTasks(many());
    cy.get('li.task').should('have.length', 500);
  });
});

describe('Tietoturvan perusasiat', () => {
  const payload = '<img src=x onerror="window.__xss=true">';

  it('ei suorita aiheeseen tai kuvaukseen kirjoitettua HTML:ää (XSS)', () => {
    cy.visit('/');
    cy.window().then((win) => {
      win.__xss = false;
    });
    cy.addTask({
      topic: payload,
      description: '<script>window.__xss=true</script>',
    });
    cy.get('#task-list .title').should('have.text', payload);
    cy.get('#task-list img, #task-list script').should('not.exist');
    cy.window().its('__xss').should('not.eq', true);
  });

  it('tallennettu XSS-syöte pysyy vaarattomana uudelleenlatauksen jälkeen', () => {
    cy.visit('/');
    cy.addTask({ topic: payload });
    cy.reload();
    cy.get('#task-list .title').should('have.text', payload);
    cy.get('#task-list img').should('not.exist');
  });

  it('muokkaus ei muuta XSS-syötettä suoritettavaksi', () => {
    cy.visit('/');
    cy.addTask({ topic: payload });
    cy.get('[data-action=edit]').click();
    cy.get('#topic').should('have.value', payload);
    cy.get('#save-btn').click();
    cy.get('#task-list img').should('not.exist');
  });

  it.skip('HAAVOITTUVUUS (odotetaan epäonnistuvan): muunneltu status localStoragessa ei saa renderöityä HTML:ksi', () => {
    cy.visitWithTasks([makeTask({ topic: 'Muunneltu', status: payload })]);
    cy.get('#task-list img').should('not.exist');
  });

  it('ei tallenna selaimeen muuta kuin tehtäväavaimen', () => {
    cy.visit('/');
    cy.addTask({ topic: 'Avain' });
    cy.window().then((win) => {
      expect(Object.keys(win.localStorage)).to.deep.equal([KEY]);
      expect(Object.keys(win.sessionStorage)).to.have.length(0);
    });
  });
});

describe('Palvelin ja rajapinnat', () => {
  it('/health palauttaa ok', () => {
    cy.request('/health').then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body).to.deep.equal({ status: 'ok' });
    });
  });

  it('/version palauttaa nimen ja version', () => {
    cy.request('/version')
      .its('body')
      .should('include.keys', ['name', 'version']);
  });

  it('ei tarjoa tehtävärajapintaa (/api/tasks → 404)', () => {
    cy.request({ url: '/api/tasks', failOnStatusCode: false })
      .its('status')
      .should('eq', 404);
  });

  it('ei paljasta palvelimen lähdekoodia tai konfiguraatiota', () => {
    ['/server.js', '/package.json', '/.gitignore'].forEach((path) => {
      cy.request({ url: path, failOnStatusCode: false })
        .its('status')
        .should('eq', 404);
    });
  });

  it('estää hakemistosta poistumisen (path traversal)', () => {
    cy.request({ url: '/..%2fserver.js', failOnStatusCode: false })
      .its('status')
      .should('be.oneOf', [400, 403, 404]);
  });
});
