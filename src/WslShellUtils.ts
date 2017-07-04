/**
 * WSL mounts disks to /mnt/<disk>. The path which can be passed to the function looks like
 * C:\Directory. For the path the function will return /mnt/c/Directory
 * @param path The path to convert
 */
export function correctPath(path: string): string {
    const disk = path.substr(0, 1).toLowerCase(); // For `C:\\Directory` it will be `C`
    path = path.replace(new RegExp('\\\\', 'g'), '/'); // After the line it will look like `C:/Directory`
    const pathWithoutDisk = path.substring(path.indexOf('/') + 1); // For `C:/Directory` it will be `Directory`
    return `/mnt/${disk}/${pathWithoutDisk}`;
}
