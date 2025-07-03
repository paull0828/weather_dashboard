class WeatherApp {
  constructor() {
    // Configuration
    this.config = {
      apiKey: "17b12e8f657f1f6156ea0e3cc8cd0dce", // In production, this should be in environment variables
      baseUrl: "https://api.openweathermap.org",
      suggestionLimit: 5,
      debounceDelay: 300,
    };

    // DOM elements
    this.elements = {
      cityInput: document.getElementById("cityInput"),
      suggestions: document.getElementById("suggestions"),
      getWeatherBtn: document.getElementById("getWeatherBtn"),
      weatherResult: document.getElementById("weatherResult"),
      loadingSpinner: document.getElementById("loadingSpinner"),
      buttonText: document.getElementById("buttonText"),
    };

    // State management
    this.state = {
      isLoading: false,
      debounceTimer: null,
      selectedCityIndex: -1,
      suggestions: [],
    };

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.attachEventListeners();
    this.elements.cityInput.focus();
    console.log("Weather Dashboard initialized successfully");
  }

  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Input events
    this.elements.cityInput.addEventListener("input", (e) =>
      this.handleCityInput(e)
    );
    this.elements.cityInput.addEventListener("keydown", (e) =>
      this.handleKeyNavigation(e)
    );
    this.elements.cityInput.addEventListener("blur", () =>
      this.hideSuggestions()
    );

    // Button events
    this.elements.getWeatherBtn.addEventListener("click", () =>
      this.getWeather()
    );

    // Global events
    document.addEventListener("click", (e) => this.handleGlobalClick(e));
  }

  /**
   * Handle city input changes with debouncing
   */
  handleCityInput(event) {
    const query = event.target.value.trim();

    // Clear previous timer
    if (this.state.debounceTimer) {
      clearTimeout(this.state.debounceTimer);
    }

    // Reset selection
    this.state.selectedCityIndex = -1;

    if (query.length < 2) {
      this.hideSuggestions();
      return;
    }

    // Debounce the API call
    this.state.debounceTimer = setTimeout(() => {
      this.getCitySuggestions(query);
    }, this.config.debounceDelay);
  }

  /**
   * Handle keyboard navigation in suggestions
   */
  handleKeyNavigation(event) {
    const suggestions =
      this.elements.suggestions.querySelectorAll(".suggestion-item");

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.state.selectedCityIndex = Math.min(
          this.state.selectedCityIndex + 1,
          suggestions.length - 1
        );
        this.updateSuggestionSelection(suggestions);
        break;

      case "ArrowUp":
        event.preventDefault();
        this.state.selectedCityIndex = Math.max(
          this.state.selectedCityIndex - 1,
          -1
        );
        this.updateSuggestionSelection(suggestions);
        break;

      case "Enter":
        event.preventDefault();
        if (
          this.state.selectedCityIndex >= 0 &&
          suggestions[this.state.selectedCityIndex]
        ) {
          this.selectCity(
            suggestions[this.state.selectedCityIndex].textContent
          );
        } else {
          this.getWeather();
        }
        break;

      case "Escape":
        this.hideSuggestions();
        break;
    }
  }

  /**
   * Update visual selection of suggestions
   */
  updateSuggestionSelection(suggestions) {
    suggestions.forEach((item, index) => {
      item.style.backgroundColor =
        index === this.state.selectedCityIndex ? "#f8f9fa" : "";
    });

    // Update aria attributes
    this.elements.cityInput.setAttribute(
      "aria-activedescendant",
      this.state.selectedCityIndex >= 0
        ? `suggestion-${this.state.selectedCityIndex}`
        : ""
    );
  }

  /**
   * Handle clicks outside the component
   */
  handleGlobalClick(event) {
    if (!event.target.closest(".search-section")) {
      this.hideSuggestions();
    }
  }

  /**
   * Fetch city suggestions from API
   */
  async getCitySuggestions(query) {
    const url = `${this.config.baseUrl}/geo/1.0/direct?q=${encodeURIComponent(
      query
    )}&limit=${this.config.suggestionLimit}&appid=${this.config.apiKey}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const cities = await response.json();
      this.displaySuggestions(cities);
    } catch (error) {
      console.error("Error fetching city suggestions:", error);
      this.showError("Unable to fetch city suggestions. Please try again.");
    }
  }

  /**
   * Display city suggestions
   */
  displaySuggestions(cities) {
    if (!cities || cities.length === 0) {
      this.elements.suggestions.innerHTML =
        '<div class="suggestion-item">No cities found</div>';
      this.showSuggestions();
      return;
    }

    const suggestionsHTML = cities
      .map((city, index) => {
        const state = city.state ? `, ${city.state}` : "";
        const fullName = `${city.name}${state}, ${city.country}`;

        return `<div 
                        class="suggestion-item" 
                        id="suggestion-${index}"
                        role="option"
                        tabindex="-1"
                        onclick="weatherApp.selectCity('${fullName.replace(
                          /'/g,
                          "\\'"
                        )}')"
                    >
                        ${this.sanitizeHTML(fullName)}
                    </div>`;
      })
      .join("");

    this.elements.suggestions.innerHTML = suggestionsHTML;
    this.showSuggestions();
  }

  /**
   * Show suggestions dropdown
   */
  showSuggestions() {
    this.elements.suggestions.classList.add("show");
    this.elements.cityInput.setAttribute("aria-expanded", "true");
  }

  /**
   * Hide suggestions dropdown
   */
  hideSuggestions() {
    setTimeout(() => {
      this.elements.suggestions.classList.remove("show");
      this.elements.cityInput.setAttribute("aria-expanded", "false");
      this.state.selectedCityIndex = -1;
    }, 150); // Delay to allow click events on suggestions
  }

  /**
   * Select a city from suggestions
   */
  selectCity(cityName) {
    this.elements.cityInput.value = cityName;
    this.hideSuggestions();
    this.elements.cityInput.focus();
  }

  /**
   * Fetch and display weather data
   */
  async getWeather() {
    const fullInput = this.elements.cityInput.value.trim();
    const city = fullInput.split(",")[0]; // Extract city name only

    if (!city) {
      this.showError("Please enter a city name.");
      this.elements.cityInput.focus();
      return;
    }

    this.setLoadingState(true);

    const url = `${this.config.baseUrl}/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${this.config.apiKey}&units=metric`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "City not found. Please check the spelling and try again."
          );
        } else if (response.status === 401) {
          throw new Error(
            "API authentication failed. Please check your API key."
          );
        } else {
          throw new Error(`Failed to fetch weather data (${response.status})`);
        }
      }

      const data = await response.json();
      this.displayWeatherData(data);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      this.showError(
        error.message || "Unable to fetch weather data. Please try again."
      );
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Set loading state for UI feedback
   */
  setLoadingState(isLoading) {
    this.state.isLoading = isLoading;
    this.elements.getWeatherBtn.disabled = isLoading;

    if (isLoading) {
      this.elements.loadingSpinner.style.display = "inline-block";
      this.elements.buttonText.textContent = "Loading...";
    } else {
      this.elements.loadingSpinner.style.display = "none";
      this.elements.buttonText.textContent = "Get Weather";
    }
  }

  /**
   * Display weather data in a professional format
   */
  displayWeatherData(data) {
    const weatherHTML = `
                    <div class="weather-card">
                        <div class="weather-header">
                            <div class="city-name">${this.sanitizeHTML(
                              data.name
                            )}, ${this.sanitizeHTML(data.sys.country)}</div>
                            <div class="temperature">${Math.round(
                              data.main.temp
                            )}°C</div>
                        </div>
                        
                        <div class="weather-details">
                            <div class="detail-item">
                                <div class="detail-label">Feels Like</div>
                                <div class="detail-value">${Math.round(
                                  data.main.feels_like
                                )}°C</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Humidity</div>
                                <div class="detail-value">${
                                  data.main.humidity
                                }%</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Pressure</div>
                                <div class="detail-value">${
                                  data.main.pressure
                                } hPa</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Wind Speed</div>
                                <div class="detail-value">${
                                  data.wind.speed
                                } m/s</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Visibility</div>
                                <div class="detail-value">${(
                                  data.visibility / 1000
                                ).toFixed(1)} km</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">UV Index</div>
                                <div class="detail-value">N/A</div>
                            </div>
                        </div>
                        
                        <div class="weather-description">
                            ${this.sanitizeHTML(data.weather[0].description)}
                        </div>
                    </div>
                `;

    this.elements.weatherResult.innerHTML = weatherHTML;

    // Announce to screen readers
    this.announceToScreenReader(
      `Weather data loaded for ${data.name}. Temperature is ${Math.round(
        data.main.temp
      )} degrees Celsius.`
    );
  }

  /**
   * Show error message with proper styling
   */
  showError(message) {
    const errorHTML = `
                    <div class="error-message" role="alert">
                        <strong>Error:</strong> ${this.sanitizeHTML(message)}
                    </div>
                `;
    this.elements.weatherResult.innerHTML = errorHTML;

    // Announce error to screen readers
    this.announceToScreenReader(`Error: ${message}`);
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   */
  sanitizeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Announce messages to screen readers
   */
  announceToScreenReader(message) {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}

// Initialize the application when DOM is loaded
let weatherApp;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    weatherApp = new WeatherApp();
  });
} else {
  weatherApp = new WeatherApp();
}

// Error handling for uncaught errors
window.addEventListener("error", (event) => {
  console.error("Uncaught error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
