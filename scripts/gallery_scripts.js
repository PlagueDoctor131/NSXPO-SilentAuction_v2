const gallery_version = "__SITE_VERSION__"

function watchForDeploymentUpdates() {
    setInterval(() => {
        fetch("site-version.json?check=" + Date.now(), { cache: "no-store" })
            .then(response => response.json())
            .then(({ version }) => {
                if (version && version !== gallery_version) {
                    const url = `${window.location.pathname}?v=${encodeURIComponent(version)}${window.location.hash}`;
                    window.location.replace(url);
                }
            })
            .catch(() => { });
    }, 60000);
}

watchForDeploymentUpdates();
let galleryItems = [];

function createImageCarousel(images, itemId) {
    let currentIndex = 0;
    const wrapper = document.createElement("div");
    wrapper.className = "carousel";

    const img = document.createElement("img");
    img.src = images[currentIndex];
    wrapper.appendChild(img);

    if (images.length > 1) {
        const leftBtn = document.createElement("button");
        leftBtn.textContent = "◀";
        leftBtn.className = "carousel-btn left";
        leftBtn.onclick = () => {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            console.log("Switched left to", currentIndex, images[currentIndex]); // DEBUG
            img.src = images[currentIndex];
        };

        const rightBtn = document.createElement("button");
        rightBtn.textContent = "▶";
        rightBtn.className = "carousel-btn right";
        rightBtn.onclick = () => {
            currentIndex = (currentIndex + 1) % images.length;
            console.log("Switched right to", currentIndex, images[currentIndex]); // DEBUG
            img.src = images[currentIndex];
        };

        wrapper.appendChild(leftBtn);
        wrapper.appendChild(rightBtn);
    }

    return wrapper;
}

function renderItems() {
    const container = document.getElementById("gallery");
    container.innerHTML = "";
    galleryItems.forEach(item => {
        const card = document.createElement("details");
        card.className = "item";

        const summary = document.createElement("summary");

        // Create carousel for this item
        const imgCarousel = createImageCarousel(item.images || [item.img], item.id);
        summary.appendChild(imgCarousel);

        // Create info container
        const info = document.createElement("div");
        info.className = "item-info";
        info.innerHTML = `
  <span class="title"><strong>${item.name}</strong></span><br>
  <span class="donor"><strong>Donated by:</strong> ${item.donor}</span>
`;
        summary.appendChild(info);

        card.appendChild(summary);



        const expanded = document.createElement("div");
        expanded.className = "expanded";
        expanded.innerHTML = `
        
        <p>${item.desc}</p>
      `;
        card.appendChild(expanded);
        container.appendChild(card);
    });
}
// load items
fetch("gallery.json?v=" + gallery_version)
    .then(r => r.json())
    .then(data => {
        galleryItems = data;
        renderItems();
    })
    .catch(err => console.error("Failed to load items:", err));