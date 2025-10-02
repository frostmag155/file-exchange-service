const API_BASE_URL = 'http://localhost:3000';

// авторизация
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');
    
    //заглушка
    if (username === 'admin' && password === 'password') {
        // Сохраняем токен
        localStorage.setItem('authToken', 'admin-token');
        message.textContent = 'Успешный вход! Перенаправление...';
        message.className = 'message success';
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    } else {
        message.textContent = 'Неверный логин или пароль';
        message.className = 'message error';
    }
});

// проверка авторизации при загрузке 
if (window.location.pathname.endsWith('dashboard.html')) {
    const token = localStorage.getItem('authToken');
    if (!token || token !== 'admin-token') {
        window.location.href = 'index.html';
    } else {
        initDashboard();
    }
}

function initDashboard() {
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    });

    // загрузка файла
    document.getElementById('uploadForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Выберите файл');
            return;
        }

        await uploadFile(file);
    });

    document.getElementById('refreshStats').addEventListener('click', loadStats);
    
    loadStats();
}

// функция загрузки файла
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    try {
        progress.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressFill.style.width = percent + '%';
                progressText.textContent = Math.round(percent) + '%';
            }
        });

        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showUploadedLink(response.downloadUrl, file.name);
                progress.style.display = 'none';
                document.getElementById('fileInput').value = '';
                loadStats(); 
            } else {
                alert('Ошибка загрузки: ' + xhr.responseText);
                progress.style.display = 'none';
            }
        });

        xhr.addEventListener('error', function() {
            alert('Ошибка сети при загрузке файла');
            progress.style.display = 'none';
        });

        xhr.open('POST', `${API_BASE_URL}/api/upload`);
        xhr.setRequestHeader('Authorization', 'Bearer admin-token');
        xhr.send(formData);

    } catch (error) {
        alert('Ошибка: ' + error.message);
        progress.style.display = 'none';
    }
}

// показываем ссылку
function showUploadedLink(url, fileName) {
    const linksList = document.getElementById('linksList');
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
        <strong>${fileName}</strong><br>
        <a href="${url}" class="file-link" target="_blank">${url}</a>
        <br><small>Скопируйте ссылку для скачивания</small>
    `;
    linksList.prepend(linkItem); 
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stats`, {
            headers: {
                'Authorization': 'Bearer admin-token'
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            displayStats(stats);
        } else {
            console.error('Ошибка загрузки статистики:', response.status);
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}
function displayStats(stats) {
  const statsList = document.getElementById('statsList');
  statsList.innerHTML = '';

  if (stats.length === 0) {
    statsList.innerHTML = '<div class="stat-item">Нет загруженных файлов</div>';
    return;
  }

  stats.forEach(stat => {
    const statItem = document.createElement('div');
    statItem.className = 'stat-item';
    const lastDownload = stat.lastDownload ? 
      new Date(stat.lastDownload).toLocaleDateString() : 'Еще не скачивали';
    
    statItem.innerHTML = `
      <strong>${stat.originalName}</strong><br>
      <small>ID: ${stat.id}</small><br>
      Количество загрузок: ${stat.downloadCount}<br>
      Дата загрузки: ${new Date(stat.uploadDate).toLocaleDateString()}<br>
      Последнее скачивание: ${lastDownload}
    `;
    statsList.appendChild(statItem);
  });
}