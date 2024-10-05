document.getElementById('saveDesk').addEventListener('click', () => {
  const deskName = document.getElementById('deskName').value;
  if (deskName) {
    chrome.runtime.sendMessage({ action: 'saveDesk', deskName: deskName }, () => {
      listDesks();
    });
  }
});

document.getElementById('exportDesks').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'exportDesks' }, (response) => {
    const blob = new Blob([response], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'desks.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

function listDesks() {
  chrome.runtime.sendMessage({ action: 'listDesks' }, (response) => {
    const deskList = document.getElementById('deskList');
    deskList.innerHTML = '';
    response.forEach(deskName => {
      const listItem = document.createElement('li');
      listItem.className = 'desk-item';
      
      const nameElement = document.createElement('p');
      nameElement.className = 'desk-name';
      nameElement.textContent = deskName;

      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = 'Restore';
      restoreBtn.className = 'restore-btn';
      restoreBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'restoreDesk', deskName: deskName });
      });

      const updateBtn = document.createElement('button');
      updateBtn.textContent = 'Update';
      updateBtn.className = 'update-btn';
      updateBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'updateDesk', deskName: deskName }, () => {
          listDesks();
        });
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'deleteDesk', deskName: deskName }, () => {
          listDesks();
        });
      });

      listItem.appendChild(nameElement);
      listItem.appendChild(restoreBtn);
      listItem.appendChild(updateBtn);
      listItem.appendChild(deleteBtn);
      deskList.appendChild(listItem);
    });
  });
}

// Initial load of saved desks
listDesks();
