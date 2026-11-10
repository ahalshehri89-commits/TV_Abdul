# TV_Abdul: Samsung Smart TV Sideloading & Installation Guide

This guide provides complete, step-by-step instructions for building, packaging, and installing **TV_Abdul** onto your Samsung Smart TV running **Tizen OS** from a **Windows PC** (with supplemental commands for macOS/Linux).

---

## Prerequisites & Architecture Overview

- **Target Device:** Samsung Smart TV (Tizen OS 3.0+, 2017 models or newer).
- **Development PC:** Windows 10 or Windows 11 (64-bit).
- **Network:** The Samsung TV and Windows PC must be connected to the **same local Wi-Fi or wired network**.
- **Package Output:** `TV_Abdul.wgt` (Tizen Web Widget package).

---

## Step 1: Enable Developer Mode on Your Samsung TV

Before your TV can accept sideloaded applications, you must enable Developer Mode:

1. Turn on your Samsung TV and press the **Home** or **Smart Hub** button on your remote.
2. Navigate to **Apps**.
3. While on the Apps screen, enter the numeric sequence on your remote:
   $$\mathbf{1 \rightarrow 2 \rightarrow 3 \rightarrow 4 \rightarrow 5}$$
   *(Note: If your Samsung remote does not have number buttons, use the on-screen numeric keypad or the SmartThings app remote).*
4. A **Developer Mode configuration popup** will appear on the TV screen.
5. Toggle **Developer Mode** to **ON**.
6. In the **Host PC IP** field, enter the local IPv4 address of your Windows PC (e.g., `192.168.1.50`).
   > *To find your Windows IP: Open Command Prompt (`cmd`) and type `ipconfig`. Look for "IPv4 Address".*
7. Click **OK**.
8. **Restart the TV:** Power off the TV by holding down the **Power button** on the remote for 3–5 seconds until the Samsung logo reappears, or unplug the TV power cable for 10 seconds and plug it back in.

---

## Step 2: Install Tizen Studio & TV Extensions on Windows

1. **Download Tizen Studio:**
   - Download the official installer from [Samsung Developers: Tizen Studio](https://developer.samsung.com/smarttv/develop/tools/tizen-studio.html).
   - Choose the **Windows 64-bit Web IDE installer**.
2. **Run Installer:**
   - Install to the default directory (e.g., `C:\tizen-studio`).
3. **Install TV Extensions via Package Manager:**
   - Launch **Tizen Package Manager** (installed alongside Tizen Studio).
   - In the **Main SDK** tab, install **Baseline SDK** and **Web app development**.
   - Click the **Extension SDK** tab.
   - Under **TV Extension**, install:
     - `TV Extensions-X.X` (choose the latest available version)
     - `Samsung Certificate Extension` (critical for creating Samsung author certificates).
4. **Add Tizen Tools to Windows PATH:**
   - Add `C:\tizen-studio\tools` and `C:\tizen-studio\tools\ide\bin` to your Windows System Environment Variables `PATH`.

---

## Step 3: Create Samsung Author & Distributor Certificates

Samsung TVs enforce security certificate verification even in Developer Mode. Creating a certificate profile takes 2 minutes:

1. Open **Tizen Studio**.
2. From the top menu, navigate to **Tools > Certificate Manager**.
3. Click the **+** (New Profile) icon.
4. Select **Samsung** (do not select Tizen generic).
5. Choose **TV** as the device type.
6. **Author Certificate:**
   - Choose **Create a new author certificate**.
   - Enter your name, password, and sign in with a free Samsung Account (or create one).
7. **Distributor Certificate:**
   - Choose **Create a new distributor certificate**.
   - Privilege level: **Partner** or **Public**.
   - Add your TV's DUID (Device Unique Identifier). The Device Manager will auto-detect your connected TV's DUID.
8. Click **Finish**. Set this certificate profile as **Active**.

---

## Step 4: Connect PC to Your Samsung TV

1. Open **Tizen Device Manager** from Tizen Studio (or click the Device Manager icon).
2. Click the **Remote Device Manager** icon (network icon in the top right).
3. Click **Scan** to search for your TV automatically, or click **+ (Add Device)**:
   - **Name:** `SamsungTV`
   - **IP Address:** Enter your TV's IP address (found in TV *Settings > General > Network > Network Status > IP Settings*).
   - **Port:** `26101` (default).
4. Click **Connect** toggle to **ON**.
5. Once connected, right-click your TV in Device Manager and select **Permit to install applications**. This pushes your Samsung author certificate onto the TV.

*(Alternatively, via Windows Command Prompt / SDB command):*
```cmd
sdb connect 192.168.1.100
sdb devices
```

---

## Step 5: Build and Package TV_Abdul

Inside this project directory (`Desktop\TV_Abdul`):

1. **Install Dependencies (if not already done):**
   ```cmd
   npm install
   ```
2. **Compile the Production Web Application:**
   ```cmd
   npm run build
   ```
3. **Generate the Tizen Widget Package (`.wgt`):**
   ```cmd
   npm run package
   ```
   This creates `TV_Abdul.wgt` in the project root and in `dist/`.

---

## Step 6: Install TV_Abdul on Your Samsung TV

### Method A: Using SDB Command Line (Fastest)

Run the following command in Windows Command Prompt or PowerShell:

```cmd
sdb install TV_Abdul.wgt
```

You should see:
```text
pulled TV_Abdul.wgt 100%
installing TV_Abdul.wgt...
...
package_path /opt/usr/apps/tmp/TV_Abdul.wgt
app_id[Abdul00101.TVAbdul] install completed
```

### Method B: Using Tizen Studio GUI

1. In Tizen Studio, select **File > Import > Tizen > Tizen Project**.
2. Select **Archive file** and choose `TV_Abdul.wgt`, or select the `Desktop\TV_Abdul` directory as an existing project.
3. Right-click the imported project in Project Explorer.
4. Select **Run As > 1 Tizen Web Application**.
5. Tizen Studio will automatically sign the package with your active certificate, transfer it to the TV, and launch it immediately.

---

## Step 7: Launch & Use the Application

1. On your Samsung TV remote, press the **Home** button.
2. In the app ribbon or inside **Apps > Downloaded Apps**, locate **TV_Abdul**.
3. Select **TV_Abdul** with the Enter button to launch.
4. **Remote Control Usage:**
   - **D-Pad (Arrows):** Navigate between categories and channel cards.
   - **Enter / OK:** Open channel and start live streaming.
   - **Back / Return:** Return from video player to channel guide, or close dialogs.
   - **Channel Up / Channel Down (▲ / ▼):** Zap to next or previous channel during playback.
   - **Left / Right (◄ / ►):** Switch to alternative stream feeds for the current channel.
   - **Play / Pause:** Toggle playback state.

---

## Step 8: Updating the Installed Application

Whenever a new build or update is made:
1. Re-run `npm run build && npm run package`.
2. Connect to the TV: `sdb connect <TV_IP>`.
3. Sideload the updated build:
   ```cmd
   sdb install TV_Abdul.wgt
   ```
4. The TV will update the application in-place, preserving your stored favorites and history.

---

## Step 9: Troubleshooting & FAQ

### Issue: `sdb connect` fails with "Connection refused" or timeout
- **Solution:** 
  1. Confirm your TV and PC are on the identical subnet (e.g. both on 192.168.1.x).
  2. Confirm Developer Mode on the TV is **ON** and your PC's IP is entered in the TV host IP field.
  3. Power-cycle the TV (hold remote power button 5 seconds).

### Issue: `sdb install` fails with `failed to check signature` or `certificate error`
- **Solution:**
  1. Make sure you selected **Samsung Certificate Profile** (not generic Tizen) in Certificate Manager.
  2. In Tizen Device Manager, right-click your connected TV and click **Permit to install applications**.
  3. In Tizen Studio, right-click the project, select **Build Signed Package**, and install the resulting signed `.wgt`.

### Issue: Video stream shows "Connecting..." or buffering spinner indefinitely
- **Solution:**
  1. Press **Left / Right** on the remote to switch to an alternative stream source for that channel.
  2. Some streams may have temporary upstream outages. The application automatically detects failed streams and fails over to backup feeds.
