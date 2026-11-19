const STORAGE_KEY = 'todo_tasks_v1';

// Avaa sovellus valmiiksi täytetyllä localStoragella
Cypress.Commands.add('visitWithTasks', (tasks) => {
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    },
  });
});

// Sama, mutta raakamerkkijonolla (rikkinäisen datan testaamiseen)
Cypress.Commands.add('visitWithRawStorage', (raw) => {
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem(STORAGE_KEY, raw);
    },
  });
});

// Täyttää lomakkeen ja painaa Save
Cypress.Commands.add('addTask', ({ topic, priority, status, description }) => {
  if (topic) {
    cy.get('#topic')
      .clear()
      .type(topic, { delay: 0, parseSpecialCharSequences: false });
  }
  if (priority) cy.get('#priority').select(priority);
  if (status) cy.get('#status').select(status);
  if (description) {
    cy.get('#description')
      .clear()
      .type(description, { delay: 0, parseSpecialCharSequences: false });
  }
  cy.get('#save-btn').click();
});

// Palauttaa tehtävärivin aiheen perusteella
Cypress.Commands.add('taskRow', (topic) =>
  cy.contains('li.task .title', topic).closest('li.task'),
);

// Lukee tallennetut tehtävät suoraan localStoragesta
Cypress.Commands.add('storedTasks', () =>
  cy.window().then((win) => JSON.parse(win.localStorage.getItem(STORAGE_KEY))),
);
