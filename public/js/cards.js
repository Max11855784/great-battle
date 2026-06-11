const cardsGrid = document.getElementById('cards-grid');
const cardsCount = document.getElementById('cards-count');
const cardsError = document.getElementById('cards-error');
const filterButtons = document.querySelectorAll('.filter-btn');
const logoutBtn = document.getElementById('logout-btn');

let allCards = [];
let currentFilter = 'all';

function clearElement(element) {
  element.innerHTML = '';
}

function createCardElement(card) {
  const cardElement = document.createElement('div');
  cardElement.className = `library-card ${card.faction}`;

  cardElement.innerHTML = `
    <div class="library-card-faction">${card.faction}</div>

    <div class="card-top">
      <span class="card-cost">${card.cost}</span>
    </div>

    <div class="card-image">
      <img src="${card.image}" alt="${card.alias}">
    </div>

    <div class="card-name">${card.alias}</div>

    <div class="card-bottom">
      <div class="stat attack-stat">ATK ${card.attack}</div>
      <div class="stat defense-stat">DEF ${card.defense}</div>
    </div>
  `;

  const img = cardElement.querySelector('img');
  img.onerror = () => {
    img.src = '/images/cards/ant_man.webp';
  };

  return cardElement;
}

function getFilteredCards() {
  if (currentFilter === 'all') {
    return allCards;
  }

  return allCards.filter(card => card.faction === currentFilter);
}

function renderCards() {
  clearElement(cardsGrid);

  const cards = getFilteredCards();

  cardsCount.textContent = `${cards.length} card(s) shown`;

  if (cards.length === 0) {
    const message = document.createElement('p');
    message.className = 'empty-zone-message';
    message.textContent = 'No cards found.';
    cardsGrid.appendChild(message);
    return;
  }

  cards.forEach(card => {
    cardsGrid.appendChild(createCardElement(card));
  });
}

async function loadCards() {
  try {
    const response = await fetch('/api/cards');
    const result = await response.json();

    if (!result.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      cardsError.textContent = result.error;
      return;
    }

    allCards = result.data.cards;
    renderCards();
  } catch (error) {
    cardsError.textContent = 'Failed to load cards';
  }
}

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    filterButtons.forEach(item => item.classList.remove('active'));
    button.classList.add('active');

    currentFilter = button.dataset.filter;
    renderCards();
  });
});

logoutBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.ok) {
      window.location.href = result.data.redirect;
      return;
    }

    window.location.href = '/';
  } catch (error) {
    window.location.href = '/';
  }
});

loadCards();
