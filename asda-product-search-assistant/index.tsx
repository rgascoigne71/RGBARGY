/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// REMOVED: import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
// REMOVED: API_KEY constant and check

const searchForm = document.getElementById('search-form') as HTMLFormElement;
const productNameInput = document.getElementById('product-name') as HTMLInputElement;
const searchButton = document.getElementById('search-button') as HTMLButtonElement;
const messageArea = document.getElementById('message-area') as HTMLDivElement;
const resultsList = document.getElementById('results-list') as HTMLUListElement;
const selectionArea = document.getElementById('selection-area') as HTMLDivElement;
const selectedItemsListUL = document.getElementById('selected-items-list') as HTMLUListElement;
const noSelectedItemsMessage = document.getElementById('no-selected-items-message') as HTMLParagraphElement;
const finishedButton = document.getElementById('finished-button') as HTMLButtonElement;


let currentlySelectedListItemInResults: HTMLLIElement | null = null;
let selectedProductsArray: Product[] = [];

interface Product {
  name: string;
  code: string;
  asdaPrice: string; // e.g., "£1.50" or "N/A"
  tescoPrice: string; // e.g., "£1.45" or "N/A"
}

function parsePrice(priceStr: string): number | null {
  if (priceStr === "N/A" || !priceStr) {
    return null;
  }
  const numericPart = priceStr.replace(/[^0-9.]/g, '');
  const price = parseFloat(numericPart);
  return isNaN(price) ? null : price;
}

type RetailerCheaperStatus = 'asda' | 'tesco' | 'same' | 'unavailable' | 'tesco_unavailable' | 'asda_unavailable';


function getCheaperRetailer(asdaPriceStr: string, tescoPriceStr: string): RetailerCheaperStatus {
  const asdaPrice = parsePrice(asdaPriceStr);
  const tescoPrice = parsePrice(tescoPriceStr);

  if (asdaPrice === null && tescoPrice === null) {
    return 'unavailable'; // Both unavailable
  }
  if (asdaPrice === null) {
    return 'asda_unavailable'; // Tesco has price, ASDA doesn't
  }
  if (tescoPrice === null) {
    return 'tesco_unavailable'; // ASDA has price, Tesco doesn't
  }

  if (asdaPrice < tescoPrice) {
    return 'asda';
  }
  if (tescoPrice < asdaPrice) {
    return 'tesco';
  }
  return 'same';
}


searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const productName = productNameInput.value.trim();

  if (!productName) {
    messageArea.textContent = 'Please enter a product name.';
    resultsList.innerHTML = '';
    selectionArea.textContent = '';
    return;
  }

  messageArea.textContent = 'Searching on ASDA and Tesco...';
  resultsList.innerHTML = '';
  selectionArea.textContent = ''; // Clear previous selection confirmation
  searchButton.disabled = true;
  productNameInput.disabled = true;
  currentlySelectedListItemInResults = null;

  try {
    // UPDATED: Call the Netlify function
    const response = await fetch(`/.netlify/functions/product-search?productName=${encodeURIComponent(productName)}`);

    if (!response.ok) {
      let errorMsg = 'Sorry, something went wrong while searching.';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg; // Use server error if available
      } catch (e) {
        // Keep default error message if parsing error fails
      }
      throw new Error(errorMsg);
    }

    const products: Product[] = await response.json(); // The Netlify function now returns parsed JSON

    if (products && products.length > 0) {
      messageArea.textContent = `Found ${products.length} products for '${productName}':`;
      products.forEach(product => {
        const listItem = document.createElement('li');
        const priceComparisonStatus = getCheaperRetailer(product.asdaPrice, product.tescoPrice);
        
        listItem.textContent = `${product.name} (Code: ${product.code}) - ASDA: ${product.asdaPrice}, Tesco: ${product.tescoPrice}`;
        listItem.setAttribute('role', 'button');
        listItem.setAttribute('tabindex', '0');

        let ariaLabelSuffix = `ASDA price ${product.asdaPrice}, Tesco price ${product.tescoPrice}.`;
        listItem.classList.remove('asda-cheaper', 'tesco-cheaper', 'price-neutral'); 

        switch (priceComparisonStatus) {
          case 'asda':
            listItem.classList.add('asda-cheaper');
            ariaLabelSuffix += ' ASDA is cheaper.';
            break;
          case 'tesco':
            listItem.classList.add('tesco-cheaper');
            ariaLabelSuffix += ' Tesco is cheaper.';
            break;
          case 'asda_unavailable':
            listItem.classList.add('tesco-cheaper'); 
            ariaLabelSuffix += ' ASDA price not available. Tesco is effectively cheaper.';
            break;
          case 'tesco_unavailable':
            listItem.classList.add('asda-cheaper'); 
            ariaLabelSuffix += ' Tesco price not available. ASDA is effectively cheaper.';
            break;
          case 'same':
            listItem.classList.add('price-neutral');
            ariaLabelSuffix += ' Prices are the same.';
            break;
          case 'unavailable':
            listItem.classList.add('price-neutral');
            ariaLabelSuffix += ' Prices are unavailable from both retailers.';
            break;
        }
        
        listItem.setAttribute('aria-label', `Select ${product.name}, product code ${product.code}. ${ariaLabelSuffix}`);
        listItem.addEventListener('click', () => handleProductSelectionAttempt(product, listItem));
        listItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleProductSelectionAttempt(product, listItem);
            }
        });
        resultsList.appendChild(listItem);
      });
    } else {
      messageArea.textContent = `No products found for '${productName}'.`;
    }
  } catch (error) {
    console.error('Error fetching or parsing product data:', error);
    messageArea.textContent = (error as Error).message || 'Sorry, something went wrong while searching. Please try again.';
     if (resultsList.children.length === 0 && productsArrayIsEmpty(error)) { 
        messageArea.textContent = `No products found for '${productName}' or an error occurred during processing.`;
    }
  } finally {
    searchButton.disabled = false;
    productNameInput.disabled = false;
  }
});

// Helper to check if the error implies an empty product list from the backend/Gemini
function productsArrayIsEmpty(error: any): boolean {
    // This is a heuristic. If Gemini returns an empty array string `[]`
    // and JSON.parse fails on that (e.g. if it wasn't wrapped in ```json),
    // or if the backend explicitly stated no products.
    // You might refine this based on actual error messages from your function.
    if (error && error.message) {
        return error.message.includes("No products found") || error.message.includes("empty JSON array");
    }
    return true; // Default to assuming it might be an empty list scenario
}


function handleProductSelectionAttempt(product: Product, listItemElement: HTMLLIElement) {
  if (currentlySelectedListItemInResults) {
    currentlySelectedListItemInResults.classList.remove('selected');
    currentlySelectedListItemInResults.removeAttribute('aria-selected');
  }
  listItemElement.classList.add('selected'); 
  listItemElement.setAttribute('aria-selected', 'true');
  currentlySelectedListItemInResults = listItemElement;

  const isAlreadySelected = selectedProductsArray.some(p => p.name === product.name && p.code === product.code);

  if (isAlreadySelected) {
    selectionArea.textContent = `${product.name} (Code: ${product.code}) is already in your selected items.`;
  } else {
    selectedProductsArray.push(product);
    renderSelectedItemsList();
    selectionArea.textContent = `Added: ${product.name} (Code: ${product.code}) - ASDA: ${product.asdaPrice}, Tesco: ${product.tescoPrice}.`;
  }
}

function renderSelectedItemsList() {
  selectedItemsListUL.innerHTML = ''; 

  if (selectedProductsArray.length === 0) {
    noSelectedItemsMessage.style.display = 'block';
    selectedItemsListUL.style.display = 'none';
    finishedButton.disabled = true; 
  } else {
    noSelectedItemsMessage.style.display = 'none';
    selectedItemsListUL.style.display = 'block';
    finishedButton.disabled = false;
    selectedProductsArray.forEach(product => {
      const listItem = document.createElement('li');
      const priceComparisonStatus = getCheaperRetailer(product.asdaPrice, product.tescoPrice);
      
      listItem.textContent = `${product.name} (Code: ${product.code}) - ASDA: ${product.asdaPrice}, Tesco: ${product.tescoPrice}`;
      listItem.classList.remove('asda-cheaper', 'tesco-cheaper', 'price-neutral');

      switch (priceComparisonStatus) {
        case 'asda':
          listItem.classList.add('asda-cheaper');
          break;
        case 'tesco':
          listItem.classList.add('tesco-cheaper');
          break;
        case 'asda_unavailable':
          listItem.classList.add('tesco-cheaper');
          break;
        case 'tesco_unavailable':
          listItem.classList.add('asda-cheaper');
          break;
        case 'same':
        case 'unavailable':
          listItem.classList.add('price-neutral');
          break;
      }
      selectedItemsListUL.appendChild(listItem);
    });
  }
}

finishedButton.addEventListener('click', () => {
  if (selectedProductsArray.length === 0) {
    selectionArea.textContent = 'No items selected to send.';
    return;
  }

  let emailBody = "Here is your list of selected products:\n\n";
  selectedProductsArray.forEach(product => {
    emailBody += `Product: ${product.name} (Code: ${product.code})\n`;
    emailBody += `  ASDA Price: ${product.asdaPrice}\n`;
    emailBody += `  Tesco Price: ${product.tescoPrice}\n`;
    const cheaperStatus = getCheaperRetailer(product.asdaPrice, product.tescoPrice);
    switch (cheaperStatus) {
      case 'asda':
        emailBody += "  Comment: ASDA is cheaper.\n";
        break;
      case 'tesco':
        emailBody += "  Comment: Tesco is cheaper.\n";
        break;
      case 'asda_unavailable':
        emailBody += "  Comment: ASDA price not available; Tesco has price.\n";
        break;
      case 'tesco_unavailable':
        emailBody += "  Comment: Tesco price not available; ASDA has price.\n";
        break;
      case 'same':
        emailBody += "  Comment: Prices are the same.\n";
        break;
      case 'unavailable':
        emailBody += "  Comment: Prices unavailable from both retailers.\n";
        break;
    }
    emailBody += "\n"; // Add a blank line between products
  });

  const subject = "Selected Product List from Comparator";
  const mailtoLink = `mailto:richard.gascoigne@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  try {
    window.location.href = mailtoLink;
    selectionArea.textContent = 'Attempting to open your email client to send the selected items...';
  } catch (e) {
    console.error("Error opening mailto link:", e);
    selectionArea.textContent = 'Could not open email client. Please copy the list manually if needed.';
  }
});

// Initial render and button state
renderSelectedItemsList();
if (selectedProductsArray.length === 0) {
    finishedButton.disabled = true;
}
