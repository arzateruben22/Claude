/* Lumevina — service option shuffle tiles
   Vanilla port of the AnimatedCardStack component, scoped to
   services tiles: each .shuffle-tile holds a small deck of option
   cards; Switch drops the front card away while the one behind
   rises into place (the component's exit/promote animation via
   CSS transitions). Used for the new-client consultations and the
   wax services. All cards live in the DOM from load, so cart.js
   binds their Add to cart buttons like any other product. */

(function () {
  "use strict";

  document.querySelectorAll(".shuffle-tile").forEach(function (tile) {
    var button = tile.querySelector(".shuffle-btn");
    var cards = tile.querySelectorAll(".shuffle-card");
    if (!button || cards.length < 2) return;

    var animating = false;

    var setBack = function (card) {
      card.classList.remove("is-front", "is-leaving");
      card.classList.add("is-back");
      card.setAttribute("aria-hidden", "true");
      card.querySelectorAll("button").forEach(function (b) { b.tabIndex = -1; });
    };

    var setFront = function (card) {
      card.classList.remove("is-back", "is-leaving");
      card.classList.add("is-front");
      card.removeAttribute("aria-hidden");
      card.querySelectorAll("button").forEach(function (b) { b.tabIndex = 0; });
    };

    /* make sure initial tab order matches the visual state */
    cards.forEach(function (card) {
      if (card.classList.contains("is-back")) setBack(card);
    });

    button.addEventListener("click", function () {
      if (animating) return;
      animating = true;

      var front = tile.querySelector(".shuffle-card.is-front");
      var back = tile.querySelector(".shuffle-card.is-back");

      front.classList.remove("is-front");
      front.classList.add("is-leaving");
      front.setAttribute("aria-hidden", "true");
      front.querySelectorAll("button").forEach(function (b) { b.tabIndex = -1; });

      setFront(back);

      window.setTimeout(function () {
        setBack(front);
        animating = false;
      }, 600);
    });
  });
})();
