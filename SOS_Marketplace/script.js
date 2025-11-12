// Updated script.js with integrated new vendor modal close button and unique key modal handling

// Global state
let marketplaceData = {
  vendors: {},
  lastUpdatedDate: null,
};
let loggedInVendorKey = null; // vendor ID or SUPERADMIN_KEY
const SUPERADMIN_KEY = 'mpsosadmin';
let currentMarketTab = 'now'; // 'now' or 'preorder'

// Utility: format price display
function formatPrice(priceCash, pricePayday) {
  const cashStr = priceCash !== null && !isNaN(priceCash) ? `₱${priceCash.toFixed(2)}` : 'N/A';
  const paydayStr = pricePayday !== null && !isNaN(pricePayday) ? `₱${pricePayday.toFixed(2)}` : 'N/A';
  return `Cash: ${cashStr} | Payday: ${paydayStr}`;
}

// Generate unique item ID
function generateItemId(vendorId, itemName) {
  const sanitizedItem = itemName.replace(/[^a-zA-Z0-9]/g, '');
  return `${vendorId}-${sanitizedItem}-${Date.now()}`;
}

// Save logged-in vendor key to sessionStorage for simplicity
function saveLoggedInVendor(vendorKey) {
  loggedInVendorKey = vendorKey;
  sessionStorage.setItem('loggedInVendor', vendorKey);
}

function loadLoggedInVendor() {
  const key = sessionStorage.getItem('loggedInVendor');
  if (key) loggedInVendorKey = key;
}

function clearLoggedInVendor() {
  loggedInVendorKey = null;
  sessionStorage.removeItem('loggedInVendor');
}

// Fetch marketplace data from Netlify Function
async function loadMarketplaceData() {
  try {
    const response = await fetch('/.netlify/functions/getMarketplaceData');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || response.statusText);
    }
    const data = await response.json();
    marketplaceData.vendors = data.vendors || {};
    marketplaceData.lastUpdatedDate = data.lastUpdatedDate || null;
  } catch (error) {
    console.error('Failed to load marketplace data:', error);
    openAlertModal(`Failed to load marketplace data. Please try again later. Details: ${error.message}`);
    marketplaceData = { vendors: {}, lastUpdatedDate: null };
  }
}

// Create vendor section DOM element
function createVendorSectionElement(vendorId, vendorData) {
  const section = document.createElement('section');
  section.className = 'vendor-section';
  section.id = `vendor-${vendorId}`;
  section.dataset.vendorId = vendorId;

  const vendorHeader = document.createElement('div');
  vendorHeader.className = 'vendor-header';
  vendorHeader.innerHTML = `<span class="toggle-arrow">▶</span> <span class="vendor-name">${vendorData.name}</span>
    <button class="delete-vendor-btn" data-vendor-id="${vendorId}" style="display:none;">x</button>`;
  section.appendChild(vendorHeader);

  const menuContent = document.createElement('div');
  menuContent.className = 'menu-content';
  menuContent.innerHTML = `
    <h3>Items:</h3>
    <ul class="item-list"></ul>
    <h3>Orders:</h3>
    <ul class="vendor-buyers-list"></ul>
  `;
  section.appendChild(menuContent);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-vendor-changes-btn';
  saveBtn.textContent = 'Save Changes';
  saveBtn.style.display = 'none';
  section.appendChild(saveBtn);
  saveBtn.addEventListener('click', () => saveVendorChanges(vendorId));

  return section;
}

// Render all vendors into DOM
function renderAllVendorSectionsToDOM() {
  const mainContent = document.querySelector('main');
  document.querySelectorAll('.vendor-section').forEach(s => s.remove());

  const vendorIds = Object.keys(marketplaceData.vendors).sort((a, b) => {
    const nameA = marketplaceData.vendors[a].name.toUpperCase();
    const nameB = marketplaceData.vendors[b].name.toUpperCase();
    return nameA.localeCompare(nameB);
  });

  vendorIds.forEach(vendorId => {
    const vendorData = marketplaceData.vendors[vendorId];
    const section = createVendorSectionElement(vendorId, vendorData);
    mainContent.appendChild(section);
  });

  // Attach toggle listeners
  document.querySelectorAll('.vendor-header').forEach(header => {
    header.removeEventListener('click', boundToggleVendorMenu);
    header.addEventListener('click', boundToggleVendorMenu);
  });
}

// Render consumer view
function renderConsumerView(currentTab = 'now') {
  renderAllVendorSectionsToDOM();

  document.getElementById('login-section').style.display = 'flex';
  document.getElementById('vendor-key-input').style.display = 'inline-block';
  document.getElementById('login-btn').style.display = 'inline-block';
  document.getElementById('logout-btn').style.display = 'none';
  document.querySelector('.order-form-section').style.display = 'none';
  document.querySelector('.today-buyers-section').style.display = 'none';
  document.querySelector('.buyers-container').style.display = 'none';
  document.getElementById('sold-out-btn').style.display = 'none';
  document.querySelector('.marketplace-tabs').style.display = 'flex';

  const newVendorBtn = document.getElementById('new-vendor-btn');
  if (newVendorBtn) newVendorBtn.style.display = 'inline-block';

  // Remove Clear Buyers button if exists
  const clearBuyersBtn = document.getElementById('clear-buyers-btn');
  if (clearBuyersBtn) {
    clearBuyersBtn.remove();
    if (boundHandleClearBuyers) {
      clearBuyersBtn.removeEventListener('click', boundHandleClearBuyers);
      boundHandleClearBuyers = null;
    }
  }

  // Reset buyer list header
  const buyerListHeader = document.querySelector('.today-buyers-section h2');
  if (buyerListHeader) buyerListHeader.textContent = 'Orders for Today';

  const allVendorSections = Array.from(document.querySelectorAll('.vendor-section'));
  let anyVendorHasAvailableItems = false;

  allVendorSections.forEach(section => {
    const vendorId = section.dataset.vendorId;
    const vendorData = marketplaceData.vendors[vendorId];
    const itemList = section.querySelector('.item-list');
    const menuContent = section.querySelector('.menu-content');
    const arrow = section.querySelector('.toggle-arrow');
    const saveBtn = section.querySelector('.save-vendor-changes-btn');
    const deleteBtn = section.querySelector('.delete-vendor-btn');

    if (!vendorData || !itemList || !menuContent || !arrow) {
      section.style.display = 'none';
      return;
    }

    if (saveBtn) saveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';

    // Hide "Orders:" section in consumer view
    const orderHeading = section.querySelector('.menu-content h3:last-of-type');
    const orderList = section.querySelector('.menu-content .vendor-buyers-list');
    if (orderHeading) orderHeading.style.display = 'none';
    if (orderList) orderList.style.display = 'none';

    itemList.innerHTML = '';

    let vendorHasItems = false;
    for (const itemId in vendorData.items) {
      const item = vendorData.items[itemId];
      const matchesTab = (currentTab === 'now' && !item.isPreOrder) || (currentTab === 'preorder' && item.isPreOrder);
      if (item.isAvailable && matchesTab) {
        vendorHasItems = true;
        anyVendorHasAvailableItems = true;

        const li = document.createElement('li');
        li.innerHTML = `
          <label for="${item.id}">${item.name} - ${formatPrice(item.priceCash, item.pricePayday)}</label>
          <button class="order-item-btn" data-item-id="${item.id}" data-vendor-id="${vendorId}">Order</button>
        `;
        itemList.appendChild(li);

        li.querySelector('.order-item-btn').addEventListener('click', () => openOrderModal(item, vendorId));
      }
    }

    if (vendorHasItems) {
      section.style.display = 'block';
      menuContent.style.display = 'none';
      arrow.textContent = '▶';
      arrow.style.display = 'inline-block';
    } else {
      section.style.display = 'none';
    }
  });

  // Handle no items message
  const noItemsMessageId = 'no-items-message';
  let noItemsMessage = document.getElementById(noItemsMessageId);

  if (!anyVendorHasAvailableItems) {
    if (!noItemsMessage) {
      noItemsMessage = document.createElement('p');
      noItemsMessage.id = noItemsMessageId;
      noItemsMessage.className = 'info-message';
      document.querySelector('main').prepend(noItemsMessage);
    }
    noItemsMessage.textContent = `No Items For ${currentTab === 'now' ? 'Sale' : 'Pre-Order'} Yet, Sellers Preparing.`;
    noItemsMessage.style.display = 'block';

    document.querySelectorAll('.vendor-section').forEach(s => (s.style.display = 'none'));
  } else if (noItemsMessage) {
    noItemsMessage.style.display = 'none';
  }
}

// Render vendor view
function renderVendorView(vendorId, currentTab = 'now') {
  renderAllVendorSectionsToDOM();

  document.getElementById('vendor-key-input').style.display = 'none';
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'inline-block';
  document.querySelector('.order-form-section').style.display = 'block';
  document.querySelector('.today-buyers-section').style.display = 'block';
  document.getElementById('sold-out-btn').style.display = 'inline-block';
  document.querySelector('.marketplace-tabs').style.display = 'flex';

  const newVendorBtn = document.getElementById('new-vendor-btn');
  if (newVendorBtn) newVendorBtn.style.display = 'none';

  const todayBuyersSection = document.querySelector('.today-buyers-section');
  let clearBuyersBtn = document.getElementById('clear-buyers-btn');

  if (!clearBuyersBtn) {
    clearBuyersBtn = document.createElement('button');
    clearBuyersBtn.id = 'clear-buyers-btn';
    clearBuyersBtn.className = 'button action-button';
    clearBuyersBtn.textContent = 'Clear Buyer List';
    todayBuyersSection.appendChild(clearBuyersBtn);
    boundHandleClearBuyers = handleClearBuyers;
    clearBuyersBtn.addEventListener('click', boundHandleClearBuyers);
  }
  clearBuyersBtn.style.display = 'inline-block';

  const buyerListHeader = document.querySelector('.today-buyers-section h2');
  if (buyerListHeader) buyerListHeader.textContent = 'Orders for Today';

  const addItemPreorderCheckbox = document.getElementById('other-item-preorder');
  if (addItemPreorderCheckbox) {
    addItemPreorderCheckbox.checked = currentTab === 'preorder';
  }

  document.querySelectorAll('.vendor-section').forEach(section => {
    const currentVendorId = section.dataset.vendorId;
    const saveBtn = section.querySelector('.save-vendor-changes-btn');
    const deleteBtn = section.querySelector('.delete-vendor-btn');
    const innerOrderHeading = section.querySelector('.menu-content h3:last-of-type');
    const innerOrderList = section.querySelector('.menu-content .vendor-buyers-list');

    if (currentVendorId === vendorId) {
      section.style.display = 'block';

      const vendorData = marketplaceData.vendors[vendorId];
      const itemList = section.querySelector('.item-list');
      itemList.innerHTML = '';

      for (const itemId in vendorData.items) {
        const item = vendorData.items[itemId];
        const matchesTab = (currentTab === 'now' && !item.isPreOrder) || (currentTab === 'preorder' && item.isPreOrder);

        if (matchesTab) {
          const li = document.createElement('li');
          li.innerHTML = `
            <input type="checkbox" id="item-toggle-${item.id}" data-vendor-id="${vendorId}" ${item.isAvailable ? 'checked' : ''}>
            <label for="item-toggle-${item.id}">${item.name} - ${formatPrice(item.priceCash, item.pricePayday)} <span class="toggle-btn">${item.isAvailable ? 'ON' : 'OFF'}</span></label>
            ${item.isPreOrder ? '<span class="is-preorder">(Pre-Order)</span>' : ''}
            <button class="delete-item-btn" data-item-id="${item.id}" data-vendor-id="${vendorId}">x</button>
          `;
          itemList.appendChild(li);

          li.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
            const checked = e.target.checked;
            try {
              const res = await fetch('/.netlify/functions/saveItem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  vendorId,
                  item: {
                    id: item.id,
                    isAvailable: checked,
                    name: item.name,
                    priceCash: item.priceCash,
                    pricePayday: item.pricePayday,
                    isPreOrder: item.isPreOrder,
                  },
                }),
              });
              if (!res.ok) throw new Error('Failed to update item availability');
              item.isAvailable = checked;
              li.querySelector('.toggle-btn').textContent = checked ? 'ON' : 'OFF';
            } catch (err) {
              openAlertModal(err.message);
              e.target.checked = !checked; // revert checkbox
            }
          });

          li.querySelector('.delete-item-btn').addEventListener('click', handleDeleteItem);
        }
      }

      const menuContent = section.querySelector('.menu-content');
      menuContent.style.display = 'block';

      const arrow = section.querySelector('.toggle-arrow');
      arrow.textContent = '▼';

      if (saveBtn) saveBtn.style.display = 'block';
      if (deleteBtn) deleteBtn.style.display = 'none';

      if (innerOrderHeading) innerOrderHeading.style.display = 'none';
      if (innerOrderList) innerOrderList.style.display = 'none';
    } else {
      section.style.display = 'none';
      if (saveBtn) saveBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (innerOrderHeading) innerOrderHeading.style.display = 'none';
      if (innerOrderList) innerOrderList.style.display = 'none';
    }
  });

  renderBuyersList(vendorId);
  updateBuyerListDate();
}

// Render superadmin view
function renderSuperAdminView(currentTab = 'now') {
  renderAllVendorSectionsToDOM();

  document.getElementById('login-section').style.display = 'flex';
  document.getElementById('vendor-key-input').style.display = 'none';
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'inline-block';
  document.querySelector('.order-form-section').style.display = 'none';
  document.querySelector('.today-buyers-section').style.display = 'none';
  document.getElementById('sold-out-btn').style.display = 'none';
  document.querySelector('.marketplace-tabs').style.display = 'flex';

  const newVendorBtn = document.getElementById('new-vendor-btn');
  if (newVendorBtn) newVendorBtn.style.display = 'none';

  const clearBuyersBtn = document.getElementById('clear-buyers-btn');
  if (clearBuyersBtn) {
    clearBuyersBtn.remove();
    if (boundHandleClearBuyers) {
      clearBuyersBtn.removeEventListener('click', boundHandleClearBuyers);
      boundHandleClearBuyers = null;
    }
  }

  const allVendorSections = Array.from(document.querySelectorAll('.vendor-section'));
  allVendorSections.forEach(section => {
    const vendorId = section.dataset.vendorId;
    const vendorData = marketplaceData.vendors[vendorId];
    const itemList = section.querySelector('.item-list');
    const vendorBuyersList = section.querySelector('.vendor-buyers-list');
    const menuContent = section.querySelector('.menu-content');
    const arrow = section.querySelector('.toggle-arrow');
    const saveBtn = section.querySelector('.save-vendor-changes-btn');
    const deleteBtn = section.querySelector('.delete-vendor-btn');

    if (!vendorData || !itemList || !vendorBuyersList || !menuContent || !arrow) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    menuContent.style.display = 'none';
    arrow.textContent = '▶';
    arrow.style.display = 'inline-block';

    if (saveBtn) saveBtn.style.display = 'none';
    if (deleteBtn) {
      deleteBtn.style.display = 'inline-block';
      deleteBtn.removeEventListener('click', handleDeleteVendor);
      deleteBtn.addEventListener('click', handleDeleteVendor);
    }

    itemList.innerHTML = '';
    vendorBuyersList.innerHTML = '';

    let hasItemsForTab = false;
    for (const itemId in vendorData.items) {
      const item = vendorData.items[itemId];
      const matchesTab = (currentTab === 'now' && !item.isPreOrder) || (currentTab === 'preorder' && item.isPreOrder);
      if (matchesTab) {
        hasItemsForTab = true;
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${item.name} - ${formatPrice(item.priceCash, item.pricePayday)} </span>
          <span class="${item.isAvailable ? 'available-status' : 'sold-out-status'}">(${item.isAvailable ? 'Available' : 'Sold Out'})</span>
          ${item.isPreOrder ? '<span class="is-preorder">(Pre-Order)</span>' : ''}
        `;
        itemList.appendChild(li);
      }
    }
    if (!hasItemsForTab) {
      const li = document.createElement('li');
      li.textContent = `No ${currentTab === 'now' ? 'Now Selling' : 'Pre-Order'} items listed.`;
      itemList.appendChild(li);
    }

    if (vendorData.buyers && vendorData.buyers.length > 0) {
      vendorData.buyers.forEach((buyer, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${buyer.buyerName} - ${buyer.orderAccount} ordered ${buyer.itemName} (${buyer.paymentMethod}) on ${buyer.date} at ${buyer.time}`;
        vendorBuyersList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No orders for this vendor yet.';
      vendorBuyersList.appendChild(li);
    }
  });
}

// --- Event Handlers ---

async function handleLogin() {
  const vendorKeyInput = document.getElementById('vendor-key-input');
  const enteredKey = vendorKeyInput.value.trim();

  if (enteredKey === SUPERADMIN_KEY) {
    saveLoggedInVendor(SUPERADMIN_KEY);
    await loadMarketplaceData();
    renderSuperAdminView(currentMarketTab);
    vendorKeyInput.value = '';
    return;
  }

  if (!marketplaceData.vendors[enteredKey]) {
    await loadMarketplaceData();
  }

  if (marketplaceData.vendors[enteredKey]) {
    saveLoggedInVendor(enteredKey);
    renderVendorView(enteredKey, currentMarketTab);
    vendorKeyInput.value = '';
  } else {
    openAlertModal('Invalid Vendor Key. Please ensure your key is correct or register as a new vendor.');
    vendorKeyInput.value = '';
  }
}

function handleLogout() {
  clearLoggedInVendor();
  renderConsumerView(currentMarketTab);
}

function toggleVendorMenu(event) {
  if (!loggedInVendorKey || loggedInVendorKey === SUPERADMIN_KEY) {
    const vendorHeader = event.currentTarget;
    const vendorSection = vendorHeader.closest('.vendor-section');
    const menuContent = vendorSection.querySelector('.menu-content');
    const arrow = vendorHeader.querySelector('.toggle-arrow');

    if (menuContent && arrow) {
      const isHidden = menuContent.style.display === 'none' || menuContent.style.display === '';
      menuContent.style.display = isHidden ? 'block' : 'none';
      arrow.textContent = isHidden ? '▼' : '▶';
    }
  }
}

// Save vendor changes (add/update items)
async function saveVendorChanges(vendorId) {
  const vendorSection = document.getElementById(`vendor-${vendorId}`);
  if (!vendorSection) return;

  const itemCheckboxes = vendorSection.querySelectorAll('.item-list input[type="checkbox"]');
  const updatedItems = [];

  itemCheckboxes.forEach(checkbox => {
    const itemId = checkbox.id.replace('item-toggle-', '');
    const vendorItems = marketplaceData.vendors[vendorId]?.items || {};
    if (vendorItems[itemId]) {
      updatedItems.push({
        ...vendorItems[itemId],
        isAvailable: checkbox.checked,
      });
    }
  });

  const otherItemName = document.getElementById('other-item-name').value.trim();
  const otherItemPriceCash = parseFloat(document.getElementById('other-item-price-cash').value);
  const otherItemPricePayday = parseFloat(document.getElementById('other-item-price-payday').value);
  const otherItemPreorder = document.getElementById('other-item-preorder').checked;

  if (otherItemName) {
    const newItemId = generateItemId(vendorId, otherItemName);
    updatedItems.push({
      id: newItemId,
      name: otherItemName,
      priceCash: isNaN(otherItemPriceCash) ? null : otherItemPriceCash,
      pricePayday: isNaN(otherItemPricePayday) ? null : otherItemPricePayday,
      isAvailable: true,
      isPreOrder: otherItemPreorder,
    });
  }

  try {
    for (const item of updatedItems) {
      const res = await fetch('/.netlify/functions/saveItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, item }),
      });
      if (!res.ok) throw new Error('Failed to save item changes');
    }

    await loadMarketplaceData();
    renderVendorView(vendorId, currentMarketTab);

    if (otherItemName) {
      document.getElementById('other-item-name').value = '';
      document.getElementById('other-item-price-cash').value = '';
      document.getElementById('other-item-price-payday').value = '';
      document.getElementById('other-item-preorder').checked = false;
    }

    openAlertModal('Changes saved!');
  } catch (error) {
    openAlertModal(error.message);
  }
}

function handleAddItem() {
  if (loggedInVendorKey) {
    saveVendorChanges(loggedInVendorKey);
  } else {
    openAlertModal('You must be logged in as a vendor to add items.');
  }
}

// Handle Sold Out button
async function handleSoldOut() {
  if (!loggedInVendorKey || loggedInVendorKey === SUPERADMIN_KEY) {
    openAlertModal(loggedInVendorKey === SUPERADMIN_KEY ? 'Superadmin cannot use the "Sold Out" button.' : 'You must be logged in as a vendor to use the "Sold Out" button.');
    return;
  }
  const vendorId = loggedInVendorKey;
  if (!marketplaceData.vendors[vendorId]) return;

  openConfirmModal('Are you sure you want to mark ALL your items as "Sold Out"?', async () => {
    try {
      const res = await fetch('/.netlify/functions/markVendorItemsSoldOut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, currentTab: currentMarketTab }),
      });
      if (!res.ok) throw new Error('Failed to mark items as sold out');

      await loadMarketplaceData();
      renderVendorView(vendorId, currentMarketTab);
      openAlertModal('All your items on this tab are now marked as "Sold Out"!');
    } catch (error) {
      openAlertModal(error.message);
    }
  });
}

// Handle Delete Vendor
async function handleDeleteVendor(event) {
  const vendorIdToDelete = event.target.dataset.vendorId;
  if (!vendorIdToDelete) {
    openAlertModal('Error: No vendor ID found for deletion.');
    return;
  }

  openConfirmModal(`Are you sure you want to delete the account for "${marketplaceData.vendors[vendorIdToDelete].name}"? This action cannot be undone.`, async () => {
    try {
      const res = await fetch('/.netlify/functions/deleteVendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: vendorIdToDelete }),
      });
      if (!res.ok) throw new Error('Failed to delete vendor');

      await loadMarketplaceData();
      renderSuperAdminView(currentMarketTab);
      openAlertModal(`Vendor "${vendorIdToDelete}" has been deleted.`);
    } catch (error) {
      openAlertModal(error.message);
    }
  });
}

// Handle Delete Item
async function handleDeleteItem(event) {
  const itemIdToDelete = event.target.dataset.itemId;
  const vendorId = event.target.dataset.vendorId;

  if (!itemIdToDelete || !vendorId) {
    openAlertModal('Error: No item or vendor ID found for deletion.');
    return;
  }

  openConfirmModal(`Are you sure you want to delete "${marketplaceData.vendors[vendorId].items[itemIdToDelete].name}"? This action cannot be undone.`, async () => {
    try {
      const res = await fetch('/.netlify/functions/deleteItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: itemIdToDelete, vendorId }),
      });
      if (!res.ok) throw new Error('Failed to delete item');

      await loadMarketplaceData();
      renderVendorView(vendorId, currentMarketTab);
      openAlertModal('Item deleted successfully!');
    } catch (error) {
      openAlertModal(error.message);
    }
  });
}

// Handle Clear Buyers
async function handleClearBuyers() {
  if (!loggedInVendorKey || loggedInVendorKey === SUPERADMIN_KEY) {
    openAlertModal(loggedInVendorKey === SUPERADMIN_KEY ? 'Superadmin cannot clear buyer lists.' : 'You must be logged in as a vendor to clear the buyer list.');
    return;
  }
  openConfirmModal('Are you sure you want to clear ALL orders for today? This action cannot be undone.', async () => {
    try {
      const res = await fetch('/.netlify/functions/clearVendorOrders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: loggedInVendorKey }),
      });
      if (!res.ok) throw new Error('Failed to clear buyer orders');

      await loadMarketplaceData();
      renderBuyersList(loggedInVendorKey);
      openAlertModal('Buyer list cleared!');
    } catch (error) {
      openAlertModal(error.message);
    }
  });
}

// Open Order Modal
let currentOrderItemData = null;
let currentOrderVendorId = null;

function openOrderModal(itemData, vendorId) {
  currentOrderItemData = itemData;
  currentOrderVendorId = vendorId;

  const orderModal = document.getElementById('orderModal');
  document.getElementById('modal-order-item-display').value = itemData.name;
  document.getElementById('modal-order-vendor-display').value = marketplaceData.vendors[vendorId]?.name || '';

  document.getElementById('modal-order-name').value = '';
  document.getElementById('modal-order-account').value = '';
  const checkedPayment = document.querySelector('input[name="modal-payment-method"]:checked');
  if (checkedPayment) checkedPayment.checked = false;

  const modalPaymentCash = document.getElementById('modal-payment-cash');
  const modalPaymentPayday = document.getElementById('modal-payment-payday');

  if (itemData.priceCash !== null && !isNaN(itemData.priceCash)) {
    modalPaymentCash.disabled = false;
    modalPaymentCash.nextElementSibling.textContent = `Cash (₱${itemData.priceCash.toFixed(2)})`;
  } else {
    modalPaymentCash.disabled = true;
    modalPaymentCash.checked = false;
    modalPaymentCash.nextElementSibling.textContent = `Cash (N/A)`;
  }

  if (itemData.pricePayday !== null && !isNaN(itemData.pricePayday)) {
    modalPaymentPayday.disabled = false;
    modalPaymentPayday.nextElementSibling.textContent = `Payday (₱${itemData.pricePayday.toFixed(2)})`;
  } else {
    modalPaymentPayday.disabled = true;
    modalPaymentPayday.checked = false;
    modalPaymentPayday.nextElementSibling.textContent = `Payday (N/A)`;
  }

  orderModal.style.display = 'flex';
}

function closeOrderModal() {
  const orderModal = document.getElementById('orderModal');
  orderModal.style.display = 'none';
}

async function confirmOrderFromModal() {
  if (!currentOrderItemData || !currentOrderVendorId) {
    openAlertModal('An item must be selected to place an order.');
    return;
  }

  const orderName = document.getElementById('modal-order-name').value.trim();
  const orderAccount = document.getElementById('modal-order-account').value.trim();
  const orderNote = document.getElementById('modal-order-note').value.trim();
  const paymentMethod = document.querySelector('input[name="modal-payment-method"]:checked')?.value;

  if (!orderName || !orderAccount || !orderNote || !paymentMethod) {
    openAlertModal('Please fill in all order details: Your Name, Your Account/Identifier, and Payment Method.');
    return;
  }

  if (paymentMethod === 'Cash' && (currentOrderItemData.priceCash === null || isNaN(currentOrderItemData.priceCash))) {
    openAlertModal('Cash payment is not available for this item.');
    return;
  }
  if (paymentMethod === 'Payday' && (currentOrderItemData.pricePayday === null || isNaN(currentOrderItemData.pricePayday))) {
    openAlertModal('Payday payment is not available for this item.');
    return;
  }

  const today = new Date();
  const options = { month: '2-digit', day: '2-digit' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const orderDate = today.toLocaleDateString('en-US', options);
  const orderTime = today.toLocaleTimeString('en-US', timeOptions);

  const newBuyer = {
    vendorId: currentOrderVendorId,
    buyerName: orderName,
    orderAccount,
    buyerNote: orderNote,
    itemName: currentOrderItemData.name,
    paymentMethod,
    date: orderDate,
    time: orderTime,
    isPreOrder: currentOrderItemData.isPreOrder,
  };

  try {
    const res = await fetch('/.netlify/functions/placeOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBuyer),
    });

    if (!res.ok) throw new Error('Failed to place order');
    await loadMarketplaceData();
    openAlertModal('Order placed successfully!');
    closeOrderModal();

    if (loggedInVendorKey === currentOrderVendorId) {
      renderBuyersList(loggedInVendorKey);
    }
  } catch (error) {
    openAlertModal(error.message);
  }
}

// Render buyers list for vendor
function renderBuyersList(vendorId) {
  const buyersListElement = document.getElementById('buyers-list');
  if (!buyersListElement) return;

  buyersListElement.innerHTML = '';

  const vendorBuyers = marketplaceData.vendors[vendorId]?.buyers || [];

  if (vendorBuyers.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No orders for this vendor yet.';
    buyersListElement.appendChild(li);
    return;
  }

  vendorBuyers.forEach((buyer, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${buyer.buyerName} ${buyer.orderAccount} - ${buyer.itemName} [${buyer.paymentMethod}/${buyer.buyerNote}/${buyer.time}]`;
    buyersListElement.appendChild(li);
  });
}

function updateBuyerListDate() {
  const dateElement = document.querySelector('.today-buyers-section .section-date');
  if (dateElement) {
    const today = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    dateElement.textContent = `${today.toLocaleDateString('en-US', options)}`;
  }
}

// Tab click handler
function handleTabClick(event) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  currentMarketTab = event.target.dataset.tab;

  if (loggedInVendorKey === SUPERADMIN_KEY) {
    renderSuperAdminView(currentMarketTab);
  } else if (loggedInVendorKey) {
    renderVendorView(loggedInVendorKey, currentMarketTab);
  } else {
    renderConsumerView(currentMarketTab);
  }
}

// Modal alert and confirm functions
let currentAlertCallback = null;
function openAlertModal(message, callback = null) {
  const alertModal = document.getElementById('alertModal');
  document.getElementById('alert-message').textContent = message;
  alertModal.style.display = 'flex';
  currentAlertCallback = callback;
}
function closeAlertModal() {
  const alertModal = document.getElementById('alertModal');
  alertModal.style.display = 'none';
  if (currentAlertCallback) {
    currentAlertCallback();
    currentAlertCallback = null;
  }
}

let currentConfirmCallback = null;
function openConfirmModal(message, callback) {
  const confirmModal = document.getElementById('confirmModal');
  document.getElementById('confirm-message').textContent = message;
  confirmModal.style.display = 'flex';
  currentConfirmCallback = callback;
}
function closeConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.style.display = 'none';
}
function confirmYesAction() {
  closeConfirmModal();
  if (currentConfirmCallback) {
    currentConfirmCallback();
    currentConfirmCallback = null;
  }
}
function confirmNoAction() {
  closeConfirmModal();
  currentConfirmCallback = null;
}

// --- New Vendor Modal & Generated Key Modal Event Bindings ---

function bindNewVendorModalEvents() {
  const newVendorModal = document.getElementById('newVendorModal');
  if (!newVendorModal) return;

  const closeBtn = newVendorModal.querySelector('.close-button');
  if (closeBtn) closeBtn.addEventListener('click', () => closeNewVendorModal());

  const form = document.getElementById('new-vendor-form');
  if (form) form.addEventListener('submit', confirmNewVendor);
}

function bindGeneratedKeyModalEvents() {
  const genKeyModal = document.getElementById('generatedKeyModal');
  if (!genKeyModal) return;

  const closeBtn = genKeyModal.querySelector('.close-button');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeGeneratedKeyModal();
    renderConsumerView(currentMarketTab);
  });

  const confirmBtn = document.getElementById('generated-key-modal-confirm-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    closeGeneratedKeyModal();
    renderConsumerView(currentMarketTab);
  });
}

// New vendor modal functions
function openNewVendorModal() {
  const modal = document.getElementById('newVendorModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('new-vendor-full-name').value = '';
  document.getElementById('new-vendor-account').value = '';
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-price-cash').value = '';
  document.getElementById('new-item-price-payday').value = '';
  document.getElementById('new-item-preorder').checked = false;
}

function closeNewVendorModal() {
  const modal = document.getElementById('newVendorModal');
  if (modal) modal.style.display = 'none';
  closeGeneratedKeyModal();
}

function openGeneratedKeyModal(key) {
  const modal = document.getElementById('generatedKeyModal');
  if (modal) {
    document.getElementById('generated-vendor-key').textContent = key;
    modal.style.display = 'flex';
  }
}

function closeGeneratedKeyModal() {
  const modal = document.getElementById('generatedKeyModal');
  if (modal) modal.style.display = 'none';
}

// Confirm new vendor registration
async function confirmNewVendor(event) {
  event.preventDefault();

  const fullName = document.getElementById('new-vendor-full-name').value.trim();
  const account = document.getElementById('new-vendor-account').value.trim();
  const itemName = document.getElementById('new-item-name').value.trim();
  const itemPriceCash = parseFloat(document.getElementById('new-item-price-cash').value);
  const itemPricePayday = parseFloat(document.getElementById('new-item-price-payday').value);
  const itemPreorder = document.getElementById('new-item-preorder').checked;

  if (!fullName || !account) {
    openAlertModal("Please enter the Vendor's Full Name and Account.");
    return;
  }

  try {
    const response = await fetch('/.netlify/functions/registerVendor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        account,
        itemName,
        itemPriceCash: isNaN(itemPriceCash) ? null : itemPriceCash,
        itemPricePayday: isNaN(itemPricePayday) ? null : itemPricePayday,
        itemPreorder,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Failed to register new vendor (Status: ${response.status})`);

    closeNewVendorModal();
    openGeneratedKeyModal(result.vendorKey);
  } catch (error) {
    openAlertModal(`Error registering vendor: ${error.message}`);
  }
}

// Event listener binding references
const boundHandleLogin = handleLogin;
const boundHandleLogout = handleLogout;
const boundToggleVendorMenu = toggleVendorMenu;
const boundHandleAddItem = handleAddItem;
const boundCloseOrderModal = closeOrderModal;
const boundWindowClick = (event) => {
  const orderModal = document.getElementById('orderModal');
  const alertModal = document.getElementById('alertModal');
  const confirmModal = document.getElementById('confirmModal');
  if (event.target === orderModal) closeOrderModal();
  if (event.target === alertModal) closeAlertModal();
};
const boundConfirmOrderFromModal = (event) => {
  event.preventDefault();
  confirmOrderFromModal();
};
const boundHandleSoldOut = handleSoldOut;
let boundHandleClearBuyers = null;
let boundHandleTabClick = handleTabClick;

// Attach/detach event listeners
function attachEventListeners() {
  detachEventListeners();

  document.getElementById('login-btn').addEventListener('click', boundHandleLogin);
  document.getElementById('logout-btn').addEventListener('click', boundHandleLogout);

  const addItemBtn = document.querySelector('.add-item-btn');
  if (addItemBtn) addItemBtn.addEventListener('click', boundHandleAddItem);

  const orderModalCloseButton = document.querySelector('#orderModal .close-button');
  if (orderModalCloseButton) orderModalCloseButton.addEventListener('click', boundCloseOrderModal);

  window.addEventListener('click', boundWindowClick);

  const modalOrderForm = document.getElementById('modal-order-form');
  if (modalOrderForm) modalOrderForm.addEventListener('submit', boundConfirmOrderFromModal);

  const soldOutBtn = document.getElementById('sold-out-btn');
  if (soldOutBtn) soldOutBtn.addEventListener('click', boundHandleSoldOut);

  const newVendorBtn = document.getElementById('new-vendor-btn');
  if (newVendorBtn) newVendorBtn.addEventListener('click', openNewVendorModal);

  // Alert Modal buttons
  document.querySelector('#alertModal .close-button').addEventListener('click', closeAlertModal);
  document.getElementById('alert-ok-button').addEventListener('click', closeAlertModal);

  // Confirm Modal buttons
  document.querySelector('#confirmModal .close-button').addEventListener('click', confirmNoAction);
  document.getElementById('confirm-yes-button').addEventListener('click', confirmYesAction);
  document.getElementById('confirm-no-button').addEventListener('click', confirmNoAction);

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', boundHandleTabClick);
  });

  // Bind new vendor and generated key modal events
  bindNewVendorModalEvents();
  bindGeneratedKeyModalEvents();
}

function detachEventListeners() {
  document.getElementById('login-btn').removeEventListener('click', boundHandleLogin);
  document.getElementById('logout-btn').removeEventListener('click', boundHandleLogout);

  const addItemBtn = document.querySelector('.add-item-btn');
  if (addItemBtn) addItemBtn.removeEventListener('click', boundHandleAddItem);

  const orderModalCloseButton = document.querySelector('#orderModal .close-button');
  if (orderModalCloseButton) orderModalCloseButton.removeEventListener('click', boundCloseOrderModal);

  window.removeEventListener('click', boundWindowClick);

  const modalOrderForm = document.getElementById('modal-order-form');
  if (modalOrderForm) modalOrderForm.removeEventListener('submit', boundConfirmOrderFromModal);

  const soldOutBtn = document.getElementById('sold-out-btn');
  if (soldOutBtn) soldOutBtn.removeEventListener('click', boundHandleSoldOut);

  const clearBuyersBtn = document.getElementById('clear-buyers-btn');
  if (clearBuyersBtn && boundHandleClearBuyers) {
    clearBuyersBtn.removeEventListener('click', boundHandleClearBuyers);
    boundHandleClearBuyers = null;
  }

  const newVendorBtn = document.getElementById('new-vendor-btn');
  if (newVendorBtn) newVendorBtn.removeEventListener('click', openNewVendorModal);

  document.querySelector('#alertModal .close-button').removeEventListener('click', closeAlertModal);
  document.getElementById('alert-ok-button').removeEventListener('click', closeAlertModal);

  document.querySelector('#confirmModal .close-button').removeEventListener('click', confirmNoAction);
  document.getElementById('confirm-yes-button').removeEventListener('click', confirmYesAction);
  document.getElementById('confirm-no-button').removeEventListener('click', confirmNoAction);

  document.querySelectorAll('.tab-btn').forEach(button => {
    button.removeEventListener('click', boundHandleTabClick);
  });

  // Remove new vendor modal listeners
  const newVendorModal = document.getElementById('newVendorModal');
  if (newVendorModal) {
    const closeNewVendorBtn = newVendorModal.querySelector('.close-button');
    if (closeNewVendorBtn) closeNewVendorBtn.removeEventListener('click', closeNewVendorModal);
    const newVendorForm = document.getElementById('new-vendor-form');
    if (newVendorForm) newVendorForm.removeEventListener('submit', confirmNewVendor);
  }

  // Remove generated key modal listeners
  const generatedKeyModal = document.getElementById('generatedKeyModal');
  if (generatedKeyModal) {
    const closeGeneratedKeyBtn = generatedKeyModal.querySelector('.close-button');
    if (closeGeneratedKeyBtn) closeGeneratedKeyBtn.removeEventListener('click', closeGeneratedKeyModal);
    const confirmBtn = document.getElementById('generated-key-modal-confirm-btn');
    if (confirmBtn) confirmBtn.removeEventListener('click', () => {
      closeGeneratedKeyModal();
      renderConsumerView(currentMarketTab);
    });
  }
}

// Initialization
async function initializeMarketplace() {
  updateDateTime();

  await loadMarketplaceData();

  renderAllVendorSectionsToDOM();

  const orderModal = document.getElementById('orderModal');
  if (orderModal) orderModal.style.display = 'none';

  const newVendorModal = document.getElementById('newVendorModal');
  if (newVendorModal) newVendorModal.style.display = 'none';

  const generatedKeyModal = document.getElementById('generatedKeyModal');
  if (generatedKeyModal) generatedKeyModal.style.display = 'none';

  document.getElementById('alertModal').style.display = 'none';
  document.getElementById('confirmModal').style.display = 'none';

  loadLoggedInVendor();

  attachEventListeners();

  const generatedKeyModalConfirmBtn = document.getElementById('generated-key-modal-confirm-btn');
  if (generatedKeyModalConfirmBtn) {
    generatedKeyModalConfirmBtn.addEventListener('click', () => {
      closeGeneratedKeyModal();
      renderConsumerView(currentMarketTab);
    });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === currentMarketTab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (loggedInVendorKey === SUPERADMIN_KEY) {
    renderSuperAdminView(currentMarketTab);
  } else if (loggedInVendorKey) {
    renderVendorView(loggedInVendorKey, currentMarketTab);
  } else {
    renderConsumerView(currentMarketTab);
  }
}

// Update date/time display every second
function updateDateTime() {
  const dateElement = document.querySelector('.date');
  const timeElement = document.querySelector('.time');
  const now = new Date();

  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

  if (dateElement) dateElement.textContent = `Date: ${now.toLocaleDateString('en-US', dateOptions)}`;
  if (timeElement) timeElement.textContent = `Time: ${now.toLocaleTimeString('en-US', timeOptions)}`;
}

// Modal quick guide handlers (unchanged)
const quickGuideBtn = document.getElementById('click-guide-btn');
const quickGuideModal = document.getElementById('quickGuideModal');
const quickGuideClose = document.getElementById('quickGuideCloseBtn');
const closeSpan = quickGuideModal?.querySelector('.close-button');

if (quickGuideBtn) quickGuideBtn.addEventListener('click', () => { quickGuideModal.style.display = 'block'; });
if (quickGuideClose) quickGuideClose.addEventListener('click', () => { quickGuideModal.style.display = 'none'; });
if (closeSpan) closeSpan.addEventListener('click', () => { quickGuideModal.style.display = 'none'; });

window.addEventListener('click', (e) => {
  if (e.target === quickGuideModal) quickGuideModal.style.display = 'none';
});

setInterval(updateDateTime, 1000);

document.addEventListener('DOMContentLoaded', initializeMarketplace);