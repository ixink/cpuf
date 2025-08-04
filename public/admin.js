// Constants
const API_BASE_URL = '/api';
const NOTIFICATION_TIMEOUT = 5000;
const TABS = ['logo', 'news', 'events', 'resources', 'polls', 'analytics', 'members', 'donations', 'join-events'];
const MAX_RETRIES = 2;

// Utility to show notifications
function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  const notificationMessage = document.getElementById('notification-message');
  if (!notification || !notificationMessage) return;

  notificationMessage.textContent = message;
  notification.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
  notification.classList.add(isError ? 'bg-red-500' : 'bg-green-500');
  setTimeout(() => notification.classList.add('hidden'), NOTIFICATION_TIMEOUT);
}

// Close notification
document.getElementById('close-notification')?.addEventListener('click', () => {
  document.getElementById('notification')?.classList.add('hidden');
});

// Mobile Menu Toggle
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenu && mobileMenuBtn) {
    mobileMenu.classList.toggle('hidden');
    mobileMenuBtn.classList.toggle('active');
  }
});

// Logout Handler (Desktop and Mobile)
function handleLogout() {
  localStorage.removeItem('token');
  document.getElementById('admin-login')?.classList.remove('hidden');
  document.getElementById('admin-dashboard')?.classList.add('hidden');
  document.getElementById('logout-btn')?.classList.add('hidden');
  document.getElementById('logout-btn-mobile')?.classList.add('hidden');
  document.getElementById('login-form')?.reset();
  document.getElementById('mobile-menu')?.classList.add('hidden');
  document.getElementById('mobile-menu-btn')?.classList.remove('active');
}

document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('logout-btn-mobile')?.addEventListener('click', handleLogout);

// Login Handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;
  if (!username || !password) {
    showNotification('Please enter both username and password.', true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('token', data.token);
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('logout-btn-mobile').classList.remove('hidden');
    await loadAdminContent();
  } catch (error) {
    console.error('Login error:', error.message);
    showNotification('Invalid credentials. Please try again.', true);
  }
});

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    if (!TABS.includes(tab)) return;
    document.querySelectorAll('.management-section').forEach(section => section.classList.add('hidden'));
    document.getElementById(`${tab}-section`)?.classList.remove('hidden');
    loadAdminContent(tab);
    document.getElementById('mobile-menu')?.classList.add('hidden');
    document.getElementById('mobile-menu-btn')?.classList.remove('active');
  });
});

// Chart instance for analytics
let eventJoinChart = null;

// Fetch with retry
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 503 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      return res;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}

// Load Admin Content
async function loadAdminContent(tab = 'logo') {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Please log in to access this content.', true);
    handleLogout();
    return;
  }

  try {
    if (tab === 'logo') {
      const res = await fetchWithRetry(`${API_BASE_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const settings = await res.json();
      document.getElementById('logo-url').value = settings.logo || '';
    } else if (tab === 'news') {
      const res = await fetchWithRetry(`${API_BASE_URL}/news`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch news');
      const news = await res.json();
      const newsList = document.getElementById('news-list');
      newsList.innerHTML = news.length ? '' : '<p>No news available.</p>';
      news.forEach(item => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <h3 class="text-lg font-semibold">${item.title || 'Untitled'}</h3>
          <p>${item.date || 'N/A'}</p>
          <p>${item.description || 'No description'}</p>
          ${item.image ? `<img src="${item.image}" alt="${item.title || 'Image'}" class="w-32 h-32 object-cover mt-2">` : ''}
          <div class="mt-2 flex space-x-2">
            <button onclick="editNews('${item.id}')" class="bg-blue-500 text-white py-1 px-2 rounded">Edit</button>
            <button onclick="deleteNews('${item.id}')" class="bg-red-500 text-white py-1 px-2 rounded">Delete</button>
          </div>
        `;
        newsList.appendChild(div);
      });
    } else if (tab === 'events') {
      const res = await fetchWithRetry(`${API_BASE_URL}/events`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch events');
      const events = await res.json();
      const eventList = document.getElementById('event-list');
      eventList.innerHTML = (events.running?.length + events.upcoming?.length + events.past?.length) ? '' : '<p>No events available.</p>';
      [...(events.running || []), ...(events.upcoming || []), ...(events.past || [])].forEach(event => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <h3 class="text-lg font-semibold">${event.title || 'Untitled'}</h3>
          <p>${event.date || 'N/A'}</p>
          <p>${event.description || 'No description'}</p>
          ${event.image ? `<img src="${event.image}" alt="${event.title || 'Image'}" class="w-32 h-32 object-cover mt-2">` : ''}
          <div class="mt-2 flex space-x-2">
            <button onclick="editEvent('${event.id}')" class="bg-blue-500 text-white py-1 px-2 rounded">Edit</button>
            <button onclick="deleteEvent('${event.id}')" class="bg-red-500 text-white py-1 px-2 rounded">Delete</button>
          </div>
        `;
        eventList.appendChild(div);
      });
    } else if (tab === 'resources') {
      const res = await fetchWithRetry(`${API_BASE_URL}/resources`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch resources');
      const resources = await res.json();
      const resourceList = document.getElementById('resource-list');
      resourceList.innerHTML = resources.length ? '' : '<p>No resources available.</p>';
      resources.forEach(resource => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <h3 class="text-lg font-semibold">${resource.title || 'Untitled'}</h3>
          <p>${resource.description || 'No description'}</p>
          ${resource.pdf ? `<a href="${resource.pdf}" target="_blank" class="text-blue-500 underline">View PDF</a>` : ''}
          <div class="mt-2 flex space-x-2">
            <button onclick="editResource('${resource.id}')" class="bg-blue-500 text-white py-1 px-2 rounded">Edit</button>
            <button onclick="deleteResource('${resource.id}')" class="bg-red-500 text-white py-1 px-2 rounded">Delete</button>
          </div>
        `;
        resourceList.appendChild(div);
      });
    } else if (tab === 'polls') {
      const res = await fetchWithRetry(`${API_BASE_URL}/polls`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch polls');
      const polls = await res.json();
      const pollList = document.getElementById('poll-list');
      pollList.innerHTML = polls.length ? '' : '<p>No polls available.</p>';
      polls.forEach(poll => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <h3 class="text-lg font-semibold">${poll.question || 'Untitled'}</h3>
          <p>Options: ${(poll.options || []).join(', ') || 'None'}</p>
          <p>Votes: ${Object.entries(poll.votes || {}).map(([opt, count]) => `${opt}: ${count}`).join(', ') || 'No votes'}</p>
          <div class="mt-2 flex space-x-2">
            <button onclick="editPoll('${poll.id}')" class="bg-blue-500 text-white py-1 px-2 rounded">Edit</button>
            <button onclick="deletePoll('${poll.id}')" class="bg-red-500 text-white py-1 px-2 rounded">Delete</button>
          </div>
        `;
        pollList.appendChild(div);
      });
    } else if (tab === 'analytics') {
      const chartLoading = document.getElementById('chart-loading');
      const analyticsSection = document.getElementById('analytics-section');
      if (chartLoading) chartLoading.classList.remove('hidden');
      if (analyticsSection) analyticsSection.classList.add('opacity-50');

      try {
        const res = await fetchWithRetry(`${API_BASE_URL}/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            showNotification('Session expired. Please log in again.', true);
            handleLogout();
            return;
          }
          throw new Error(`Failed to fetch analytics: ${res.statusText}`);
        }
        const analytics = await res.json();

        // Update summary metrics with fallbacks
        document.getElementById('total-members').textContent = analytics.totalMembers ?? 0;
        document.getElementById('total-event-joins').textContent = analytics.totalEventJoins ?? 0;
        document.getElementById('total-donations').textContent = analytics.totalDonations ?? 0;
        document.getElementById('total-votes').textContent = analytics.totalVotes ?? 0;

        // Event Joins Chart
        const ctx = document.getElementById('eventJoinChart')?.getContext('2d');
        if (ctx) {
          if (eventJoinChart) eventJoinChart.destroy();
          const labels = Object.keys(analytics.eventJoinBreakdown || {});
          const data = Object.values(analytics.eventJoinBreakdown || {});
          eventJoinChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels.length ? labels : ['No Data'],
              datasets: [{
                label: 'Event Joins',
                data: data.length ? data : [0],
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
                hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { font: { size: 14, weight: 'bold' } } },
                tooltip: {
                  enabled: labels.length > 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  titleFont: { size: 14 },
                  bodyFont: { size: 12 },
                  padding: 10,
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  title: { display: true, text: 'Events', font: { size: 14, weight: 'bold' } },
                  ticks: { maxRotation: 45, minRotation: 45 },
                },
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Number of Joins', font: { size: 14, weight: 'bold' } },
                  grid: { color: 'rgba(0, 0, 0, 0.1)' },
                  suggestedMax: Math.max(...data, 10) + 5,
                },
              },
            },
          });
        } else {
          console.warn('Chart canvas not found');
          showNotification('Chart unavailable. Please refresh the page.', true);
        }

        // Events by Category
        const eventsRes = await fetchWithRetry(`${API_BASE_URL}/events`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!eventsRes.ok) throw new Error('Failed to fetch events');
        const events = await eventsRes.json();
        const eventsByCategory = document.getElementById('events-by-category');
        eventsByCategory.innerHTML = '';
        const categories = {
          running: events.running?.length || 0,
          upcoming: events.upcoming?.length || 0,
          past: events.past?.length || 0,
        };
        if (Object.values(categories).every(count => count === 0)) {
          eventsByCategory.innerHTML = '<p>No events available.</p>';
        } else {
          for (const [category, count] of Object.entries(categories)) {
            const div = document.createElement('div');
            div.className = 'flex justify-between text-gray-700';
            div.innerHTML = `
              <span class="capitalize">${category}</span>
              <span class="font-bold">${count}</span>
            `;
            eventsByCategory.appendChild(div);
          }
        }

        // Votes by Poll
        const pollsRes = await fetchWithRetry(`${API_BASE_URL}/polls`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!pollsRes.ok) throw new Error('Failed to fetch polls');
        const polls = await pollsRes.json();
        const votesByPoll = document.getElementById('votes-by-poll');
        votesByPoll.innerHTML = polls.length ? '' : '<p>No polls available.</p>';
        polls.forEach(poll => {
          const totalVotes = Object.values(poll.votes || {}).reduce((sum, count) => sum + count, 0);
          const div = document.createElement('div');
          div.className = 'flex justify-between text-gray-700';
          div.innerHTML = `
            <span class="truncate w-3/4">${poll.question || 'Untitled'}</span>
            <span class="font-bold">${totalVotes}</span>
          `;
          votesByPoll.appendChild(div);
        });

        if (chartLoading) chartLoading.classList.add('hidden');
        if (analyticsSection) analyticsSection.classList.remove('opacity-50');
      } catch (error) {
        console.error('Analytics error:', error.message, { status: error.status, url: `${API_BASE_URL}/analytics` });
        showNotification('Error loading analytics. Please try again or check your connection.', true);
        if (chartLoading) chartLoading.classList.add('hidden');
        if (analyticsSection) analyticsSection.classList.remove('opacity-50');
      }
    } else if (tab === 'members') {
      const res = await fetchWithRetry(`${API_BASE_URL}/registrations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch registrations');
      const registrations = await res.json();
      const memberList = document.getElementById('member-list');
      memberList.innerHTML = registrations.length ? '' : '<p>No members available.</p>';
      registrations.forEach(member => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <p><strong>Name:</strong> ${member.name || 'N/A'}</p>
          <p><strong>Email:</strong> ${member.email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${member.phone || 'N/A'}</p>
          <p><strong>ID:</strong> ${member.idNumber || 'N/A'}</p>
          <p><strong>University:</strong> ${member.university || 'N/A'}</p>
        `;
        memberList.appendChild(div);
      });
    } else if (tab === 'donations') {
      const res = await fetchWithRetry(`${API_BASE_URL}/donations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch donations');
      const donations = await res.json();
      const donationList = document.getElementById('donation-list');
      donationList.innerHTML = donations.length ? '' : '<p>No donations available.</p>';
      donations.forEach(donation => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <p><strong>Phone:</strong> ${donation.phone || 'Anonymous'}</p>
          <p><strong>Transaction ID:</strong> ${donation.transactionId || 'N/A'}</p>
          <p><strong>Timestamp:</strong> ${donation.timestamp ? new Date(donation.timestamp).toLocaleString() : 'N/A'}</p>
        `;
        donationList.appendChild(div);
      });
    } else if (tab === 'join-events') {
      const res = await fetchWithRetry(`${API_BASE_URL}/join-events`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch join events');
      const joinEvents = await res.json();
      const joinEventList = document.getElementById('join-event-list');
      joinEventList.innerHTML = joinEvents.length ? '' : '<p>No event joins available.</p>';
      joinEvents.forEach(join => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md mb-4';
        div.innerHTML = `
          <p><strong>Event ID:</strong> ${join.eventId || 'N/A'}</p>
          <p><strong>Name:</strong> ${join.name || 'N/A'}</p>
          <p><strong>Email:</strong> ${join.email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${join.phone || 'N/A'}</p>
        `;
        joinEventList.appendChild(div);
      });
    }
  } catch (error) {
    console.error(`Error loading ${tab} content:`, error.message);
    showNotification(`Error loading ${tab} content. Please try again.`, true);
  }
}

// Logo Form
document.getElementById('logo-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const logoFile = document.getElementById('logo-file')?.files[0];
  const logoUrl = document.getElementById('logo-url')?.value.trim();
  if (!logoFile && !logoUrl) {
    showNotification('Please provide a logo file or URL.', true);
    return;
  }

  const formData = new FormData();
  if (logoFile) formData.append('logo', logoFile);
  if (logoUrl) formData.append('logoUrl', logoUrl);

  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/settings/logo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to update logo');
    showNotification('Logo updated successfully!');
    await loadAdminContent('logo');
  } catch (error) {
    console.error('Logo update error:', error.message);
    showNotification('Error updating logo. Please try again.', true);
  }
});

// News Form
document.getElementById('news-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const id = document.getElementById('news-id')?.value;
  const title = document.getElementById('news-title')?.value.trim();
  const date = document.getElementById('news-date')?.value;
  const description = document.getElementById('news-description')?.value.trim();
  const image = document.getElementById('news-image')?.files[0];
  const imageUrl = document.getElementById('news-image-url')?.value.trim();

  if (!title || !date || !description) {
    showNotification('Please fill in all required fields.', true);
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('date', date);
  formData.append('description', description);
  if (image) formData.append('image', image);
  if (imageUrl) formData.append('imageUrl', imageUrl);

  try {
    const res = await fetchWithRetry(id ? `${API_BASE_URL}/news/${id}` : `${API_BASE_URL}/news`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to save news');
    showNotification(id ? 'News updated successfully!' : 'News added successfully!');
    document.getElementById('news-form').reset();
    document.getElementById('news-id').value = '';
    await loadAdminContent('news');
  } catch (error) {
    console.error('News save error:', error.message);
    showNotification('Error saving news. Please try again.', true);
  }
});

document.getElementById('clear-news-form')?.addEventListener('click', () => {
  document.getElementById('news-form')?.reset();
  document.getElementById('news-id').value = '';
});

// Event Form
document.getElementById('event-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const id = document.getElementById('event-id')?.value;
  const title = document.getElementById('event-title')?.value.trim();
  const date = document.getElementById('event-date')?.value;
  const description = document.getElementById('event-description')?.value.trim();
  const image = document.getElementById('event-image')?.files[0];
  const imageUrl = document.getElementById('event-image-url')?.value.trim();

  if (!title || !date || !description) {
    showNotification('Please fill in all required fields.', true);
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('date', date);
  formData.append('description', description);
  if (image) formData.append('image', image);
  if (imageUrl) formData.append('imageUrl', imageUrl);

  try {
    const res = await fetchWithRetry(id ? `${API_BASE_URL}/events/${id}` : `${API_BASE_URL}/events`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to save event');
    showNotification(id ? 'Event updated successfully!' : 'Event added successfully!');
    document.getElementById('event-form').reset();
    document.getElementById('event-id').value = '';
    await loadAdminContent('events');
  } catch (error) {
    console.error('Event save error:', error.message);
    showNotification('Error saving event. Please try again.', true);
  }
});

document.getElementById('clear-event-form')?.addEventListener('click', () => {
  document.getElementById('event-form')?.reset();
  document.getElementById('event-id').value = '';
});

// Resource Form
document.getElementById('resource-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const id = document.getElementById('resource-id')?.value;
  const title = document.getElementById('resource-title')?.value.trim();
  const description = document.getElementById('resource-description')?.value.trim();
  const pdf = document.getElementById('resource-pdf')?.files[0];
  const pdfUrl = document.getElementById('resource-pdf-url')?.value.trim();

  if (!title || !description) {
    showNotification('Please fill in all required fields.', true);
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  if (pdf) formData.append('pdf', pdf);
  if (pdfUrl) formData.append('pdfUrl', pdfUrl);

  try {
    const res = await fetchWithRetry(id ? `${API_BASE_URL}/resources/${id}` : `${API_BASE_URL}/resources`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to save resource');
    showNotification(id ? 'Resource updated successfully!' : 'Resource added successfully!');
    document.getElementById('resource-form').reset();
    document.getElementById('resource-id').value = '';
    await loadAdminContent('resources');
  } catch (error) {
    console.error('Resource save error:', error.message);
    showNotification('Error saving resource. Please try again.', true);
  }
});

document.getElementById('clear-resource-form')?.addEventListener('click', () => {
  document.getElementById('resource-form')?.reset();
  document.getElementById('resource-id').value = '';
});

// Poll Form
document.getElementById('poll-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const id = document.getElementById('poll-id')?.value;
  const question = document.getElementById('poll-question')?.value.trim();
  const options = document.getElementById('poll-options')?.value.split(',').map(opt => opt.trim()).filter(opt => opt);

  if (!question || options.length < 2) {
    showNotification('Please provide a question and at least two options.', true);
    return;
  }

  try {
    const res = await fetchWithRetry(id ? `${API_BASE_URL}/polls/${id}` : `${API_BASE_URL}/polls`, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, options }),
    });
    if (!res.ok) throw new Error('Failed to save poll');
    showNotification(id ? 'Poll updated successfully!' : 'Poll added successfully!');
    document.getElementById('poll-form').reset();
    document.getElementById('poll-id').value = '';
    await loadAdminContent('polls');
  } catch (error) {
    console.error('Poll save error:', error.message);
    showNotification('Error saving poll. Please try again.', true);
  }
});

document.getElementById('clear-poll-form')?.addEventListener('click', () => {
  document.getElementById('poll-form')?.reset();
  document.getElementById('poll-id').value = '';
});

// Edit and Delete Functions
async function editNews(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/news`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch news');
    const news = await res.json();
    const item = news.find(n => n.id === id);
    if (!item) throw new Error('News item not found');
    document.getElementById('news-id').value = item.id;
    document.getElementById('news-title').value = item.title || '';
    document.getElementById('news-date').value = item.date || '';
    document.getElementById('news-description').value = item.description || '';
    document.getElementById('news-image-url').value = item.image || '';
  } catch (error) {
    console.error('Edit news error:', error.message);
    showNotification('Error loading news. Please try again.', true);
  }
}

async function deleteNews(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/news/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete news');
    showNotification('News deleted successfully!');
    await loadAdminContent('news');
  } catch (error) {
    console.error('Delete news error:', error.message);
    showNotification('Error deleting news. Please try again.', true);
  }
}

async function editEvent(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/events`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch events');
    const events = await res.json();
    const event = [...(events.running || []), ...(events.upcoming || []), ...(events.past || [])].find(e => e.id === id);
    if (!event) throw new Error('Event not found');
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title || '';
    document.getElementById('event-date').value = event.date || '';
    document.getElementById('event-description').value = event.description || '';
    document.getElementById('event-image-url').value = event.image || '';
  } catch (error) {
    console.error('Edit event error:', error.message);
    showNotification('Error loading event. Please try again.', true);
  }
}

async function deleteEvent(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/events/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete event');
    showNotification('Event deleted successfully!');
    await loadAdminContent('events');
  } catch (error) {
    console.error('Delete event error:', error.message);
    showNotification('Error deleting event. Please try again.', true);
  }
}

async function editResource(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/resources`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch resources');
    const resources = await res.json();
    const resource = resources.find(r => r.id === id);
    if (!resource) throw new Error('Resource not found');
    document.getElementById('resource-id').value = resource.id;
    document.getElementById('resource-title').value = resource.title || '';
    document.getElementById('resource-description').value = resource.description || '';
    document.getElementById('resource-pdf-url').value = resource.pdf || '';
  } catch (error) {
    console.error('Edit resource error:', error.message);
    showNotification('Error loading resource. Please try again.', true);
  }
}

async function deleteResource(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/resources/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete resource');
    showNotification('Resource deleted successfully!');
    await loadAdminContent('resources');
  } catch (error) {
    console.error('Delete resource error:', error.message);
    showNotification('Error deleting resource. Please try again.', true);
  }
}

async function editPoll(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/polls`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch polls');
    const polls = await res.json();
    const poll = polls.find(p => p.id === id);
    if (!poll) throw new Error('Poll not found');
    document.getElementById('poll-id').value = poll.id;
    document.getElementById('poll-question').value = poll.question || '';
    document.getElementById('poll-options').value = (poll.options || []).join(', ');
  } catch (error) {
    console.error('Edit poll error:', error.message);
    showNotification('Error loading poll. Please try again.', true);
  }
}

async function deletePoll(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/polls/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete poll');
    showNotification('Poll deleted successfully!');
    await loadAdminContent('polls');
  } catch (error) {
    console.error('Delete poll error:', error.message);
    showNotification('Error deleting poll. Please try again.', true);
  }
}

// Initialize Admin Dashboard
if (localStorage.getItem('token')) {
  document.getElementById('admin-login')?.classList.add('hidden');
  document.getElementById('admin-dashboard')?.classList.remove('hidden');
  document.getElementById('logout-btn')?.classList.remove('hidden');
  document.getElementById('logout-btn-mobile')?.classList.remove('hidden');
  loadAdminContent();
}

// Expose edit and delete functions globally
window.editNews = editNews;
window.deleteNews = deleteNews;
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.editResource = editResource;
window.deleteResource = deleteResource;
window.editPoll = editPoll;
window.deletePoll = deletePoll;