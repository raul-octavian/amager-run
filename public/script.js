// ========================================================================
// Amager Run 21 — Interactive Concept Page
// ========================================================================
// Process:
//   1. Theme / look switcher (Day · Night · Volt) via data attributes on <html>
//   2. Live countdown to 5 September 2027, 09:00 CET
//   3. Parallax scrolling rows in the hero section
//   4. Distance picker (5K / 10K / 21K) that updates the bib preview
//   5. Route slider moving a dot along the SVG path with elevation info
//   6. Sign-up form that generates a bib number and renders a canvas card
//
// Limitations:
//   - All logic is inline (no module bundling)
//   - Canvas text depends on the "Anton" web font loading
//   - Parallax runs on every scroll event; may be heavy on low-end devices
//   - Bib number is a simple hash of the name, not a real registration ID
//   - Form submission is simulated; nothing is sent to a backend
//
// Expected outcome:
//   Users can pick a distance, scrub the route slider, and claim a fictional
//   bib with their name, distance and a printable canvas card.
// ========================================================================

// DOM helpers -------------------------------------------------------------
const getElementById = (id) => document.getElementById(id);
const rootElement = document.documentElement;

// -------------------------------------------------------------------------
// 1. THEME / LOOK SWITCHER
// -------------------------------------------------------------------------
// Applies day / night / volt by setting data-* attributes on <html> so CSS
// can consume them. Uses [data-l] attribute selectors instead of class names.
function applyTheme(theme) {
	if (theme === "volt") {
		rootElement.dataset.look = "volt";
		delete rootElement.dataset.theme;
	} else {
		delete rootElement.dataset.look;
		rootElement.dataset.theme = theme === "night" ? "dark" : "light";
	}

	document
		.querySelectorAll(".theme-switcher button")
		.forEach((button) =>
			button.setAttribute("aria-pressed", button.dataset.l === theme),
		);
}

document.querySelectorAll(".theme-switcher button").forEach((button) => {
	button.onclick = () => applyTheme(button.dataset.l);
});

applyTheme(matchMedia("(prefers-color-scheme:dark)").matches ? "night" : "day");

// -------------------------------------------------------------------------
// 2. COUNTDOWN TO RACE DAY
// -------------------------------------------------------------------------
// Counts down to 5 September 2027, 09:00 Copenhagen time and updates every
// second. Limitation: uses the visitor's local clock; no server sync.
const raceDay = new Date("2027-09-05T09:00:00+02:00");

function updateCountdown() {
	let remainingSeconds = Math.max(
		0,
		Math.floor((raceDay - Date.now()) / 1000),
	);
	const days = Math.floor(remainingSeconds / 86400);
	remainingSeconds %= 86400;
	const hours = Math.floor(remainingSeconds / 3600);
	remainingSeconds %= 3600;
	const minutes = Math.floor(remainingSeconds / 60);
	const seconds = remainingSeconds % 60;

	getElementById("countdown-days").textContent = String(days).padStart(
		3,
		"0",
	);
	getElementById("countdown-hours").textContent = String(hours).padStart(
		2,
		"0",
	);
	getElementById("countdown-minutes").textContent = String(minutes).padStart(
		2,
		"0",
	);
	getElementById("countdown-seconds").textContent = String(seconds).padStart(
		2,
		"0",
	);
}

updateCountdown();
setInterval(updateCountdown, 1000);

// -------------------------------------------------------------------------
// 3. HERO PARALLAX ROWS
// -------------------------------------------------------------------------
// Multiple scrolling text rows that drift at different speeds. Class-based
// selection is used here because there is no unique ID per row and adding
// IDs to every row would require HTML changes.
const parallaxRows = [...document.querySelectorAll(".parallax-row")];
let heroIsVisible = true;
let animationFrameId = 0;

new IntersectionObserver((entries) => {
	heroIsVisible = entries[0].isIntersecting;
}).observe(getElementById("hero-section"));

addEventListener(
	"scroll",
	() => {
		if (!heroIsVisible || animationFrameId) return;
		animationFrameId = requestAnimationFrame(() => {
			animationFrameId = 0;
			parallaxRows.forEach((row, index) => {
				row.style.translate = `0 ${scrollY * (0.1 + index * 0.08)}px`;
			});
		});
	},
	{ passive: true },
);
// -------------------------------------------------------------------------
// 4. DISTANCE PICKER
// -------------------------------------------------------------------------
// Available race distances with start time, price, capacity and notes.
// Buttons use [data-k] attributes so we avoid class-based queries on them.
const distances = [
	{
		km: 21,
		start: "09:00",
		price: "590 kr",
		places: "2,000 places",
		notes: "Waves A, B, C",
	},
	{
		km: 10,
		start: "10:15",
		price: "390 kr",
		places: "700 places",
		notes: "Chip timed",
	},
	{
		km: 5,
		start: "11:00",
		price: "290 kr",
		places: "300 places",
		notes: "Family friendly",
	},
];

let selectedKm = 21;

function renderDistanceButtons() {
	const container = getElementById("distance-picker");
	const template = getElementById("distance-button-template");
	container.replaceChildren(
		...distances.map((distance) => {
			const isSelected = distance.km === selectedKm;
			const button = template.content.firstElementChild.cloneNode(true);
			button.dataset.k = distance.km;
			button.setAttribute("aria-pressed", isSelected);
			button.querySelector(".km-value").textContent = distance.km;
			button.querySelector(".start-time").textContent = distance.start;
			button.querySelector(".meta").textContent =
				`${distance.price} · ${distance.places} · ${distance.notes}`;
			return button;
		}),
	);
}

function selectDistance(km) {
	selectedKm = km;
	renderDistanceButtons();
	const radio = document.querySelector(
		`input[name="distance"][value="${km}"]`,
	);
	if (radio) radio.checked = true;
	updateBibPreview();
}

renderDistanceButtons();

getElementById("distance-picker").addEventListener("click", (event) => {
	const button = event.target.closest("[data-k]");
	if (button) {
		selectDistance(+button.dataset.k);
	}
});

// -------------------------------------------------------------------------
// 5. ROUTE SLIDER & ELEVATION
// -------------------------------------------------------------------------
// Moves a red dot along the SVG route path as the user scrubs the slider.
// Shows current km, elevation estimate, and nearby water stations.
// Limitation: elevation values are hardcoded estimates, not real GPS data.
const routePath = getElementById("route-path");
const routeDot = getElementById("route-dot");
const elevationPath = getElementById("elevation-path");
const routeTotalLength = routePath.getTotalLength();
const elevationProfileMeters = [
	3, 4, 5, 4, 6, 8, 12, 16, 12, 7, 5, 4, 3, 5, 7, 9, 6, 4, 3, 3, 2, 2,
];
const waterStationKilometers = [5, 10, 15, 19];

function drawElevationProfile() {
	const points = elevationProfileMeters.map(
		(elevation, index) => `${index * 10} ${70 - elevation * 3}`,
	);
	elevationPath.setAttribute("d", `M${points.join(" L")}`);
}

function updateRouteDisplay() {
	const kilometers = +getElementById("route-slider").value;
	const point = routePath.getPointAtLength(
		(routeTotalLength * kilometers) / 21,
	);

	routeDot.setAttribute("cx", point.x);
	routeDot.setAttribute("cy", point.y);

	const segmentIndex = Math.min(20, Math.floor(kilometers));
	const fraction = kilometers - segmentIndex;
	const elevationMeters = Math.round(
		elevationProfileMeters[segmentIndex] +
			(elevationProfileMeters[segmentIndex + 1] -
				elevationProfileMeters[segmentIndex]) *
				fraction,
	);

	getElementById("route-km").textContent = `${kilometers.toFixed(1)} km`;

	const nearestStation = waterStationKilometers.find(
		(station) => Math.abs(station - kilometers) < 0.4,
	);
	let statusMessage =
		kilometers < 0.2
			? "Start by the water. Breathe."
			: kilometers > 20.7
				? "The finish line. You did it."
				: nearestStation
					? "Water station here. "
					: kilometers > 7.6 && kilometers < 8.4
						? "The bridge: the only real hill. "
						: "";

	statusMessage += `About ${elevationMeters} m above sea level.`;
	getElementById("route-status").textContent = statusMessage;

	const markerX = kilometers * 10;
	getElementById("elevation-marker").setAttribute("x1", markerX);
	getElementById("elevation-marker").setAttribute("x2", markerX);
}

drawElevationProfile();

getElementById("route-slider").oninput = updateRouteDisplay;
updateRouteDisplay();
// -------------------------------------------------------------------------
// 6. BIB NUMBER & PREVIEW
// -------------------------------------------------------------------------
// Generates a stable pseudo-random bib number from the entrant's name.
// Limitation: not a real registration system; collisions are possible.
function hashNameToBibNumber(name) {
	let hash = 0;
	for (const character of name.trim().toLowerCase()) {
		hash = (hash * 31 + character.charCodeAt(0)) % 2999;
	}
	return name.trim() ? hash + 1 : 427;
}

const padWithZeros = (number) => String(number).padStart(4, "0");

function updateBibPreview() {
	const nameInput = getElementById("name-input");
	const name = nameInput.value.trim();
	const bibNumber = padWithZeros(hashNameToBibNumber(name));
	const bibNumberElement = getElementById("bib-number");

	if (bibNumberElement.textContent !== bibNumber) {
		bibNumberElement.textContent = bibNumber;
		bibNumberElement.classList.add("pop-animation");
		setTimeout(
			() => bibNumberElement.classList.remove("pop-animation"),
			180,
		);
	}

	getElementById("bib-name").textContent = name || "Your name";
	const selectedDistance = document.querySelector(
		'input[name="distance"]:checked',
	).value;
	getElementById("bib-distance").textContent =
		selectedDistance +
		" km · wave " +
		(selectedDistance === "21"
			? "A"
			: selectedDistance === "10"
				? "B"
				: "C");
}

getElementById("name-input").oninput = updateBibPreview;

document.querySelectorAll('input[name="distance"]').forEach((radio) => {
	radio.onchange = () => {
		selectedKm = +radio.value;
		renderDistanceButtons();
		updateBibPreview();
	};
});

// -------------------------------------------------------------------------
// 7. SIGN-UP FORM SUBMISSION
// -------------------------------------------------------------------------
// Validates name and email, then shows a confirmation panel.
// On success: hides the form, draws the bib canvas, marks section as done.
// Limitation: purely front-end demo; no data is sent to any backend.
const signUpForm = getElementById("sign-up-form");
const nameInput = getElementById("name-input");
const emailInput = getElementById("email-input");
const errorText = getElementById("form-error");

signUpForm.addEventListener("submit", (event) => {
	event.preventDefault();

	const name = nameInput.value.trim();
	const email = emailInput.value.trim();
	const shirtSize = getElementById("shirt-size").value;

	if (!name) {
		errorText.textContent = "Add your name. It goes on the bib.";
		return;
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
		errorText.textContent = "That email doesn't look right yet.";
		return;
	}

	errorText.textContent = "";

	const bibNumber = padWithZeros(hashNameToBibNumber(name));
	const selectedDistance = document.querySelector(
		'input[name="distance"]:checked',
	).value;

	getElementById("confirmation-title").textContent =
		`Bib ${bibNumber} is yours.`;
	getElementById("confirmation-text").textContent =
		`See you on 5 September, ${name.split(" ")[0]}.`;
	getElementById("confirmation-text-confirmation").textContent =
		` Confirmation goes to ${email}.`;
	getElementById("confirmation-text-tShirt").textContent =
		` T-shirt: ${shirtSize}.`;
	getElementById(
		"sign-up-form-wrapper",
	).parentElement.parentElement.classList.add("done");
	getElementById("bib-preview").style.display = "none";

	(document.fonts
		? document.fonts.load("100px Anton")
		: Promise.resolve()
	).then(() => drawBibCard(bibNumber, name, selectedDistance));
});

// -------------------------------------------------------------------------
// 8. CANVAS BIB CARD RENDERING
// -------------------------------------------------------------------------
// Draws the claimed bib to a <canvas> so the user can save it as an image.
// Reads CSS custom properties (--hb, --hi, --hh) for theme-aware colors.
// Expected outcome: a printable-looking bib card with number, name, distance.
// Limitation: depends on the "Anton" web font; falls back to Impact/sans-serif.
function drawBibCard(bibNumber, name, distanceKm) {
	const canvas = getElementById("bib-canvas");
	const context = canvas.getContext("2d");
	const computedStyles = getComputedStyle(rootElement);
	const headerBackground =
		computedStyles.getPropertyValue("--hb").trim() || "#0B1533";
	const headerInk = computedStyles.getPropertyValue("--hi").trim();
	const headerHighlight = computedStyles.getPropertyValue("--hh").trim();

	context.fillStyle = headerBackground;
	context.fillRect(0, 0, 1080, 1350);

	context.fillStyle = "#FF4B14";
	context.fillRect(0, 0, 1080, 70);

	context.textAlign = "center";
	context.fillStyle = headerInk;
	context.font = "64px Anton, Impact, sans-serif";
	context.fillText("AMAGER RUN 21", 540, 170);

	context.fillStyle = headerHighlight;
	context.font = "500px Anton, Impact, sans-serif";
	context.fillText(bibNumber, 540, 720);

	context.fillStyle = headerInk;
	context.font = "110px Anton, Impact, sans-serif";
	context.fillText(name.toUpperCase().slice(0, 16), 540, 900);

	context.fillStyle = "#FF4B14";
	context.font = "84px Anton, Impact, sans-serif";
	context.fillText(`${distanceKm} KM · 5 SEPTEMBER 2027`, 540, 1040);

	for (let i = 0; i < 30; i++) {
		context.fillStyle = headerInk;
		context.fillRect(60 + i * 34, 1180, 18, 60);
	}
}

updateBibPreview();
