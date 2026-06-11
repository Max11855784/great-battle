const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  loginError.textContent = '';

  const formData = new FormData(loginForm);

  const payload = {
    login: formData.get('login'),
    password: formData.get('password')
  };

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) {
      loginError.textContent = result.error;
      return;
    }

    window.location.href = result.data.redirect;
  } catch (error) {
    loginError.textContent = 'Server error';
  }
});
