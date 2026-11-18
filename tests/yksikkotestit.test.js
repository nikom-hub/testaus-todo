import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTasks,
  saveTasks,
  generateId,
  statusLabel,
  sortTasks,
  createTask,
  updateTask,
  toggleTaskCompletion,
} from '../public/taskStore.js';

const KEY = 'todo_tasks_v1';

// Muistissa toimiva localStorage, uusi jokaiselle testille
beforeEach(() => {
  const store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  });
});

// Apufunktio täyden tehtävän luontiin
const make = (over = {}) => ({
  id: 't_1',
  topic: 'Aihe',
  priority: 'medium',
  status: 'todo',
  description: '',
  completed: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...over,
});

describe('loadTasks / saveTasks', () => {
  it('palauttaa tyhjän taulukon, kun mitään ei ole tallennettu', () => {
    expect(loadTasks()).toEqual([]);
  });

  it('tallentaa ja lataa tehtävät samoina', () => {
    const tasks = [make(), make({ id: 't_2' })];
    saveTasks(tasks);
    expect(loadTasks()).toEqual(tasks);
  });

  it('käyttää avainta todo_tasks_v1', () => {
    saveTasks([make()]);
    expect(JSON.parse(localStorage.getItem(KEY))).toHaveLength(1);
  });

  it('korvaa aiemman tallennuksen kokonaan', () => {
    saveTasks([make(), make({ id: 't_2' })]);
    saveTasks([make({ id: 't_3' })]);
    expect(loadTasks().map((t) => t.id)).toEqual(['t_3']);
  });

  it('palauttaa [] rikkinäisestä JSONista', () => {
    localStorage.setItem(KEY, '{rikki');
    expect(loadTasks()).toEqual([]);
  });

  it('palauttaa [] jos tallennettu arvo ei ole taulukko', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    expect(loadTasks()).toEqual([]);
  });

  it('palauttaa [] jos getItem heittää virheen', () => {
    localStorage.getItem = () => {
      throw new Error('blocked');
    };
    expect(loadTasks()).toEqual([]);
  });

  it('heittää virheen, jos tallennus epäonnistuu', () => {
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => saveTasks([make()])).toThrow('QuotaExceededError');
  });
});

describe('generateId', () => {
  it('alkaa t_-etuliitteellä ja sisältää vain a-z ja 0-9', () => {
    expect(generateId()).toMatch(/^t_[a-z0-9]+$/);
  });

  it('tuottaa uniikkeja id:itä', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
  });
});

describe('statusLabel', () => {
  it.each([
    ['todo', 'To do'],
    ['in-progress', 'In progress'],
    ['blocked', 'Blocked'],
    ['done', 'Done'],
  ])('%s -> %s', (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it('palauttaa tuntemattoman tilan sellaisenaan', () => {
    expect(statusLabel('archived')).toBe('archived');
  });
});

describe('sortTasks', () => {
  it('ei muuta alkuperäistä taulukkoa', () => {
    const input = [
      make({ id: 'a', priority: 'low' }),
      make({ id: 'b', priority: 'high' }),
    ];
    const copy = [...input];
    const out = sortTasks(input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
  });

  it('palauttaa tyhjästä tyhjän', () => {
    expect(sortTasks([])).toEqual([]);
  });

  it('asettaa valmiit viimeiseksi', () => {
    const out = sortTasks([
      make({ id: 'done', completed: true, priority: 'high' }),
      make({ id: 'open', completed: false, priority: 'low' }),
    ]);
    expect(out.map((t) => t.id)).toEqual(['open', 'done']);
  });

  it('järjestää prioriteetin mukaan: high, medium, low', () => {
    const out = sortTasks([
      make({ id: 'l', priority: 'low' }),
      make({ id: 'h', priority: 'high' }),
      make({ id: 'm', priority: 'medium' }),
    ]);
    expect(out.map((t) => t.id)).toEqual(['h', 'm', 'l']);
  });

  it('samalla prioriteetilla uusin ensin', () => {
    const out = sortTasks([
      make({ id: 'old', createdAt: 1 }),
      make({ id: 'new', createdAt: 3 }),
      make({ id: 'mid', createdAt: 2 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(['new', 'mid', 'old']);
  });

  it('yhdistää kaikki kolme sääntöä oikeassa järjestyksessä', () => {
    const out = sortTasks([
      make({
        id: 'done-high',
        completed: true,
        priority: 'high',
        createdAt: 9,
      }),
      make({ id: 'low-new', priority: 'low', createdAt: 9 }),
      make({ id: 'high-old', priority: 'high', createdAt: 1 }),
      make({ id: 'high-new', priority: 'high', createdAt: 5 }),
    ]);
    expect(out.map((t) => t.id)).toEqual([
      'high-new',
      'high-old',
      'low-new',
      'done-high',
    ]);
  });
});

describe('createTask', () => {
  const min = { topic: 'A', priority: 'low', status: 'todo', description: '' };

  it('luo tehtävän minimisyötteellä', () => {
    const t = createTask(min, 500);
    expect(t).toMatchObject({
      ...min,
      completed: false,
      createdAt: 500,
      updatedAt: 500,
    });
    expect(t.id).toMatch(/^t_/);
  });

  it('luo tehtävän maksimisyötteellä', () => {
    const max = {
      topic: 'x'.repeat(10000),
      priority: 'high',
      status: 'in-progress',
      description: 'y'.repeat(100000),
    };
    const t = createTask(max, 1);
    expect(t.topic).toHaveLength(10000);
    expect(t.description).toHaveLength(100000);
  });

  it('säilyttää erikoismerkit sellaisenaan', () => {
    expect(createTask({ ...min, topic: '<b>Äö</b>' }, 1).topic).toBe(
      '<b>Äö</b>',
    );
  });

  it('asettaa completed=true vain kun status on done', () => {
    expect(createTask({ ...min, status: 'done' }, 1).completed).toBe(true);
    for (const s of ['todo', 'in-progress', 'blocked']) {
      expect(createTask({ ...min, status: s }, 1).completed).toBe(false);
    }
  });

  it('ei muuta syöteobjektia', () => {
    const input = { ...min };
    createTask(input, 1);
    expect(input).toEqual(min);
  });

  it('antaa jokaiselle tehtävälle eri id:n', () => {
    expect(createTask(min, 1).id).not.toBe(createTask(min, 1).id);
  });
});

describe('updateTask', () => {
  const payload = {
    topic: 'Uusi',
    priority: 'high',
    status: 'in-progress',
    description: 'kuvaus',
  };

  it('päivittää kentät ja updatedAt:n', () => {
    expect(updateTask(make(), payload, 2000)).toMatchObject({
      ...payload,
      updatedAt: 2000,
    });
  });

  it('säilyttää id:n ja createdAt:n', () => {
    const out = updateTask(make({ id: 't_x', createdAt: 42 }), payload, 2000);
    expect(out.id).toBe('t_x');
    expect(out.createdAt).toBe(42);
  });

  it('status done merkitsee tehtävän valmiiksi', () => {
    expect(
      updateTask(make(), { ...payload, status: 'done' }, 2000).completed,
    ).toBe(true);
  });

  it('muu status jättää keskeneräisen tehtävän keskeneräiseksi', () => {
    const out = updateTask(
      make({ completed: false }),
      { ...payload, status: 'blocked' },
      2000,
    );
    expect(out.completed).toBe(false);
  });

  it('valmiin tehtävän statuksen vaihto muuhun jättää completed=true (nykyinen käytös)', () => {
    const done = make({ status: 'done', completed: true });
    const out = updateTask(done, { ...payload, status: 'todo' }, 2000);
    expect(out.status).toBe('todo');
    expect(out.completed).toBe(true);
  });

  it('ei muuta alkuperäistä tehtävää', () => {
    const original = make();
    const snapshot = { ...original };
    updateTask(original, payload, 2000);
    expect(original).toEqual(snapshot);
  });
});

describe('toggleTaskCompletion', () => {
  it('keskeneräinen -> valmis, status muuttuu done', () => {
    const out = toggleTaskCompletion(make({ status: 'in-progress' }), 2000);
    expect(out).toMatchObject({
      completed: true,
      status: 'done',
      updatedAt: 2000,
    });
  });

  it('valmis -> keskeneräinen, done palautuu todo:ksi', () => {
    const out = toggleTaskCompletion(
      make({ completed: true, status: 'done' }),
      2000,
    );
    expect(out).toMatchObject({ completed: false, status: 'todo' });
  });

  it('valmis -> keskeneräinen säilyttää muun kuin done-statuksen', () => {
    const out = toggleTaskCompletion(
      make({ completed: true, status: 'blocked' }),
      2000,
    );
    expect(out).toMatchObject({ completed: false, status: 'blocked' });
  });

  it('kaksi togglea palauttaa todo-tehtävän lähtötilaan', () => {
    const back = toggleTaskCompletion(toggleTaskCompletion(make(), 1), 2);
    expect(back).toMatchObject({ completed: false, status: 'todo' });
  });

  it('ei muuta alkuperäistä tehtävää', () => {
    const t = make();
    toggleTaskCompletion(t, 5);
    expect(t.completed).toBe(false);
    expect(t.updatedAt).toBe(1000);
  });
});
