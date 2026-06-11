const ratingBody = document.getElementById('rating-body');
const ratingError = document.getElementById('rating-error');
const logoutBtn = document.getElementById('logout-btn');

let currentUserId = null;

function clearElement(element) {
  element.innerHTML = '';
}

function getTopRowClass(index) {
  if (index === 0) {
    return 'rating-row-top-1';
  }

  if (index === 1) {
    return 'rating-row-top-2';
  }

  if (index === 2) {
    return 'rating-row-top-3';
  }

  return '';
}

function createRatingRow(player, index) {
  const row = document.createElement('tr');
  const topClass = getTopRowClass(index);
  const isCurrentUser = Number(player.id) === Number(currentUserId);

  if (topClass) {
    row.classList.add(topClass);
  }

  if (isCurrentUser) {
    row.classList.add('rating-row-current');
  }

  row.innerHTML = `
    <td class="rating-place">#${index + 1}</td>
    <td>
      <img class="rating-avatar" src="${player.avatar}" alt="${player.login} avatar">
    </td>
    <td class="rating-login">
      ${player.login}
      ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
    </td>
    <td class="rating-wins">${player.wins}</td>
  `;

  const img = row.querySelector('img');

  img.onerror = () => {
    img.src = '/images/cards/ant_man.webp';
  };

  return row;
}

async function loadRating() {
  try {
    const response = await fetch('/api/rating');
    const result = await response.json();

    if (!result.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      ratingError.textContent = result.error;
      return;
    }

    currentUserId = result.data.currentUserId;

    clearElement(ratingBody);

    const players = result.data.players;

    if (players.length === 0) {
      ratingBody.innerHTML = `
        <tr>
          <td colspan="4">No players found.</td>
        </tr>
      `;
      return;
    }

    players.forEach((player, index) => {
      ratingBody.appendChild(createRatingRow(player, index));
    });
  } catch (error) {
    ratingError.textContent = 'Failed to load rating';
  }
}

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

loadRating();