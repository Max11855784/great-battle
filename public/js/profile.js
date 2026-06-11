const profileAvatar = document.getElementById('profile-avatar');
const profileLogin = document.getElementById('profile-login');
const profileCreated = document.getElementById('profile-created');

const winsCount = document.getElementById('wins-count');
const lossesCount = document.getElementById('losses-count');
const totalCount = document.getElementById('total-count');
const achievementsGrid = document.getElementById('achievements-grid');

const profileError = document.getElementById('profile-error');
const logoutBtn = document.getElementById('logout-btn');

function formatDate(value) {
  if (!value) {
    return 'unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  return date.toLocaleString();
}

function clearElement(element) {
  element.innerHTML = '';
}

function createAchievementCard(achievement) {
  const card = document.createElement('div');

  card.className = achievement.unlocked
    ? 'achievement-card achievement-unlocked'
    : 'achievement-card achievement-locked';

  const statusText = achievement.unlocked ? 'Unlocked' : 'Locked';

  card.innerHTML = `
    <div class="achievement-icon">${achievement.icon}</div>

    <div class="achievement-content">
      <h3>${achievement.title}</h3>
      <p>${achievement.description}</p>

      <div class="achievement-progress">
        Progress: ${achievement.progress} / ${achievement.target}
      </div>

      <div class="achievement-status">${statusText}</div>
    </div>
  `;

  return card;
}

function renderAchievements(achievements) {
  clearElement(achievementsGrid);

  if (!achievements || achievements.length === 0) {
    achievementsGrid.innerHTML = '<div class="empty-zone-message">No achievements found.</div>';
    return;
  }

  achievements.forEach((achievement) => {
    achievementsGrid.appendChild(createAchievementCard(achievement));
  });
}

async function loadProfile() {
  try {
    const response = await fetch('/api/profile');
    const result = await response.json();

    if (!result.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      profileError.textContent = result.error;
      return;
    }

    const user = result.data.user;
    const stats = result.data.stats;

    profileAvatar.src = user.avatar;
    profileLogin.textContent = user.login;
    profileCreated.textContent = `Created: ${formatDate(user.created_at)}`;

    winsCount.textContent = stats.wins;
    lossesCount.textContent = stats.losses;
    totalCount.textContent = stats.totalBattles;
    renderAchievements(result.data.achievements);
  } catch (error) {
    profileError.textContent = 'Failed to load profile';
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

loadProfile();
