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
    const selectFolderButton = document.getElementById('selectFolder');
    const beginMergeButton = document.getElementById('beginMerge');
    const folderPathText = document.getElementById('folderPath');
    const mergeOutputElement = document.getElementById('mergeOutput');

    if (selectFolderButton && beginMergeButton && folderPathText) {
        selectFolderButton.addEventListener('click', () => {
            ipcRenderer.invoke('select-folder').then(folderPath => {
                if (folderPath) {
                    folderPathText.textContent = `Selected Folder: ${folderPath}`;
                    beginMergeButton.style.display = 'block'; // Show the button
                }
            });
        });

        beginMergeButton.addEventListener('click', () => {
            const folderPath = folderPathText.textContent.replace('Selected Folder: ', '');
            if (folderPath) {
                ipcRenderer.send('run-merge-command', folderPath);
            } else {
                console.log("No folder selected");
            }
        });
    }

    ipcRenderer.on('merge-command-output', (event, data) => {
        if (mergeOutputElement) {
            if (data.stdout) {
                mergeOutputElement.textContent += data.stdout;
            }
            if (data.stderr) {
                mergeOutputElement.textContent += data.stderr;
            }
            scrollToBottom(mergeOutputElement);
        }
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
