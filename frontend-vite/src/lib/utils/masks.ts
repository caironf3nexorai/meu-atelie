export const maskCPF = (value: string) => {
    return value
        .replace(/\D/g, '') // remove não números
        .replace(/(\d{3})(\d)/, '$1.$2') // coloca o primeiro ponto
        .replace(/(\d{3})(\d)/, '$1.$2') // coloca o segundo ponto
        .replace(/(\d{3})(\d{1,2})/, '$1-$2') // coloca o traço
        .replace(/(-\d{2})\d+?$/, '$1'); // impede mais que 11 digitos
};

export const maskPhone = (value: string) => {
    let v = value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
};

export const maskCEP = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{5})(\d)/, '$1-$2')
        .slice(0, 9);
};

export const maskCreditCard = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 16);
    const parts: string[] = [];
    for (let i = 0; i < v.length; i += 4) {
        parts.push(v.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
};

export const maskExpiry = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1/$2')
        .slice(0, 5);
};

export const maskCVV = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 4);
};

export const getCardFlag = (cardNumber: string) => {
    const number = cardNumber.replace(/\D/g, '');
    if (number.match(/^4/)) return 'visa';
    if (number.match(/^(5[1-5]|2[2-7])/)) return 'mastercard';
    if (number.match(/^3[47]/)) return 'amex';
    if (number.match(/^(6011|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5]|64[4-9])|65)/)) return 'discover';
    if (number.match(/^3[068]/)) return 'diners';
    if (number.match(/^(50|5[6-9]|6|606282)/)) return 'elo'; // Elo simplificado
    return 'unknown';
};
