const registerForm = document.getElementById('register-form');
const registerError = document.getElementById('register-error');

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  registerError.textContent = '';

  const formData = new FormData(registerForm);

  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (password !== confirmPassword) {
    registerError.textContent = 'Passwords do not match';
    return;
  }

  const payload = {
    login: formData.get('login'),
    password: password,
    avatarCode: formData.get('avatarCode')
  };

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) {
      registerError.textContent = result.error;
      return;
    }

    window.location.href = result.data.redirect;
  } catch (error) {
    registerError.textContent = 'Server error';
  }
});
