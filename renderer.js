const { ipcRenderer } = require('electron');


function scrollToBottom(element) {
    requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
    });
}
function setupBacteriaPage() {
    const runButton = document.getElementById('runCommand');
    if (runButton) {
        runButton.addEventListener('click', () => {
            ipcRenderer.send('run-command', 'bash /Users/malhal/dev/CGELabs/t.sh');
        });

        ipcRenderer.on('command-output', (event, { stdout, stderr }) => {
            const outputElement = document.getElementById('output');
            if (outputElement) {
                if (stdout) {
                    outputElement.textContent += 'STDOUT: ' + stdout + '\n';
                }
                if (stderr) {
                    outputElement.textContent += 'STDERR: ' + stderr + '\n';
                }
                scrollToBottom(outputElement);

            }
        });
    }
}

function setupFastQMergePage() {
    document.getElementById('selectFolder').addEventListener('click', () => {
        ipcRenderer.invoke('select-folder').then(folderPath => {
            if (folderPath) {
                document.getElementById('folderPath').textContent = `Selected Folder: ${folderPath}`;
                document.getElementById('beginMerge').style.display = 'block'; // Show the button
            }
        });
    });

    document.getElementById('beginMerge').addEventListener('click', () => {
        const folderPath = document.getElementById('folderPath').textContent.replace('Selected Folder: ', '');
        if (folderPath) {
            ipcRenderer.send('run-merge-command', folderPath);
        } else {
            console.log("No folder selected");
        }
        // Here you will later trigger the actual merge command
    });

    ipcRenderer.on('merge-command-output', (event, data) => {
        const outputElement = document.getElementById('mergeOutput');
        if (data.stdout) {
            outputElement.textContent += data.stdout;
        }
        if (data.stderr) {
            outputElement.textContent += data.stderr;
        }
        scrollToBottom(outputElement);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const page = this.getAttribute('href').substring(1);
            fetch(page + '.html')
                .then(response => response.text())
                .then(data => {
                    const mainContent = document.querySelector('.main-content');
                    mainContent.innerHTML = data;
                    if (page === 'bacteria') {
                        setupBacteriaPage();
                    } else if (page === 'fastqmerge') {
                        setupFastQMergePage();
                    }
                });
        });
    });
});



document.getElementById('selectFolder').addEventListener('click', () => {
    ipcRenderer.invoke('select-folder').then(folderPath => {
        if (folderPath) {
            ipcRenderer.send('run-merge-command', folderPath);
        }
    });
});

ipcRenderer.on('merge-command-output', (event, data) => {
    const outputElement = document.getElementById('mergeOutput');
    if (data.stdout) {
        outputElement.textContent += data.stdout;
    }
    if (data.stderr) {
        outputElement.textContent += data.stderr;
    }
    // Implement auto-scroll here if needed
});