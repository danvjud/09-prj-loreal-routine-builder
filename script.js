/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

/* Store selected products and conversation history */
let selectedProducts = [];
let messages = [];
let allProducts = []; // Store all loaded products for filtering

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load all products on page load for filtering */
loadProducts().then((products) => {
  allProducts = products;
});

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-id="${product.id}" style="cursor: pointer;">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");

  /* Add click handlers to select/deselect products */
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("selected");
      const productId = card.dataset.id;
      const productName = card.querySelector("h3").textContent;
      const productBrand = card.querySelector("p").textContent;

      if (card.classList.contains("selected")) {
        /* Add product to selected list */
        selectedProducts.push({
          id: productId,
          name: productName,
          brand: productBrand,
        });
      } else {
        /* Remove product from selected list */
        selectedProducts = selectedProducts.filter((p) => p.id !== productId);
      }

      /* Update displayed selected products */
      updateSelectedProductsDisplay();
    });
  });
}

/* Update the display of selected products */
function updateSelectedProductsDisplay() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="no-products">No products selected yet</p>';
  } else {
    selectedProductsList.innerHTML = selectedProducts
      .map(
        (product) => `
      <div class="selected-product-bubble" data-product-id="${product.id}">
        <span>${product.name}</span>
        <button type="button" class="remove-btn" aria-label="Remove ${product.name}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `
      )
      .join("");

    /* Add click handlers to remove buttons */
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const bubble = btn.closest(".selected-product-bubble");
        const productId = bubble.dataset.productId;

        /* Remove product from selected list */
        selectedProducts = selectedProducts.filter((p) => p.id !== productId);

        /* Deselect the product card in the grid */
        const productCard = document.querySelector(
          `.product-card[data-id="${productId}"]`
        );
        if (productCard) {
          productCard.classList.remove("selected");
        }

        /* Update display */
        updateSelectedProductsDisplay();
      });
    });
  }
}

/* Filter and display products based on category and search input */
async function filterAndDisplayProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = searchInput.value.toLowerCase().trim();

  // If no category is selected, show placeholder
  if (!selectedCategory) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  // Filter by category first
  let filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );

  // Then filter by search term (search in name, brand, and category)
  if (searchTerm) {
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand.toLowerCase().includes(searchTerm) ||
        (product.category && product.category.toLowerCase().includes(searchTerm))
    );
  }

  // If no products match, show a message
  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found matching your search
      </div>
    `;
    return;
  }

  // Display the filtered products
  displayProducts(filteredProducts);
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", filterAndDisplayProducts);

/* Filter and display products when search input changes */
searchInput.addEventListener("input", filterAndDisplayProducts);

/* Chat form submission handler - call Cloudflare Worker with selected products */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  /* Clear input field */
  userInput.value = "";

  /* Display user message in chat window */
  chatWindow.innerHTML += `
    <div class="message user-message">
      <p>${userMessage}</p>
    </div>
  `;

  /* Add user message to conversation history */
  messages.push({
    role: "user",
    content: userMessage,
  });

  /* Show loading indicator while waiting for response */
  chatWindow.innerHTML += `
    <div class="message bot-message loading">
      <p>Building your routine...</p>
    </div>
  `;

  try {
    /* Build request body with selected products context and conversation history */
    const requestBody = {
      messages: [
        {
          role: "system",
          content: `You are a helpful L'Oréal skincare and beauty advisor. 
          The user has selected the following products: ${selectedProducts.map((p) => p.name).join(", ") || "No products selected yet"}.
          Help them build personalized routines and answer questions about their selected products.`,
        },
        ...messages,
      ],
    };

    /* Call the class-hosted Cloudflare Worker */
    const response = await fetch(
      "https://loreal-project-chatbot.dannjudson.workers.dev/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    const assistantReply = data.choices[0].message.content;

    /* Add assistant reply to conversation history */
    messages.push({
      role: "assistant",
      content: assistantReply,
    });

    /* Remove loading indicator and display assistant response */
    const loadingMessage = chatWindow.querySelector(".loading");
    if (loadingMessage) {
      loadingMessage.remove();
    }

    chatWindow.innerHTML += `
      <div class="message bot-message">
        <p>${assistantReply}</p>
      </div>
    `;

    /* Scroll chat window to show latest message */
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (error) {
    console.error("Error calling Cloudflare Worker:", error);

    /* Remove loading indicator and show error message */
    const loadingMessage = chatWindow.querySelector(".loading");
    if (loadingMessage) {
      loadingMessage.remove();
    }

    chatWindow.innerHTML += `
      <div class="message error-message">
        <p>Sorry, there was an error. Please make sure the Cloudflare Worker URL is correct and try again.</p>
      </div>
    `;
  }
});

/* Generate initial routine when "Generate Routine" button is clicked */
generateRoutineBtn.addEventListener("click", () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML =
      '<div class="error-message">Please select at least one product first!</div>';
    return;
  }

  /* Clear conversation history and start fresh */
  messages = [];

  /* Create initial prompt for routine generation */
  const productList = selectedProducts
    .map((p) => `${p.name} (${p.brand})`)
    .join(", ");
  const initialPrompt = `Please create a personalized skincare and beauty routine using these products: ${productList}. 
  Include morning and evening routines, tips for each product, and any important notes.`;

  /* Programmatically trigger chat form submission with initial prompt */
  userInput.value = initialPrompt;
  chatForm.dispatchEvent(new Event("submit"));
});
